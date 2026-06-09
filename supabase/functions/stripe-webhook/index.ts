import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

// Stripe webhooks must NOT have CORS headers nor a JWT check.
// `verify_jwt = false` is set in supabase/config.toml.

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!STRIPE_KEY || !WEBHOOK_SECRET) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server not configured", { status: 500 });
  }

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-12-18.acacia" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature ?? "",
      WEBHOOK_SECRET,
    );
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          (session.metadata?.supabase_user_id as string) ?? null;
        const planId = (session.metadata?.plan_id as string) ?? "unknown";
        const subId = session.subscription as string | null;
        if (userId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(supabase, userId, planId, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string) ??
          (await lookupUserIdByCustomer(supabase, sub.customer as string));
        const planId = (sub.metadata?.plan_id as string) ?? "unknown";
        if (userId) await upsertSubscription(supabase, userId, planId, sub);
        break;
      }
      default:
        // no-op
        break;
    }
  } catch (err: any) {
    console.error("[stripe-webhook] handler error", err);
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

async function upsertSubscription(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  sub: Stripe.Subscription,
) {
  const item = sub.items.data[0];
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: planId,
      status: sub.status,
      stripe_customer_id: sub.customer as string,
      stripe_subscription_id: sub.id,
      stripe_price_id: item?.price?.id ?? null,
      quantity: item?.quantity ?? 1,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function lookupUserIdByCustomer(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}
