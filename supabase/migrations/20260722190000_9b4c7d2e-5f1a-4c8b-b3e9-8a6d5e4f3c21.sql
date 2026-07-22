-- Moteur d'alertes email (fonction send-alerts + cron horaire côté prod).
-- La landing vend « Alertes email illimitées, en temps réel » : jusqu'ici les
-- alertes créées dans /alerts n'étaient jamais envoyées (aucun expéditeur).
-- last_sent_at trace le dernier envoi par alerte — c'est la garde
-- d'idempotence de send-alerts (daily : >= 20 h entre deux envois,
-- weekly : >= 6,5 j), qui rend le cron horaire inoffensif.
-- (Exécutée en production le 2026-07-22 ; cron « send-alerts-hourly »
-- planifié à la minute 20.)

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
