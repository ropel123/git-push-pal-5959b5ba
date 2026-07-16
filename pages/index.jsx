import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>$BROKE — Still Bullish</title>
        <meta
          name="description"
          content="$BROKE — the meme coin for degens who lost everything except their conviction."
        />
      </Head>
      <iframe
        title="$BROKE — Still Bullish"
        src="/site.html"
        style={{ width: "100vw", height: "100vh", border: 0, display: "block" }}
      />
    </>
  );
}
