/**
 * Rend un texte brut en transformant les URLs http(s) en liens cliquables
 * (nouvel onglet). Utilisé pour les champs d'avis (description, critères…)
 * qui contiennent souvent « Le DCE est disponible sur https://… ».
 */
const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

const Linkify = ({ text }: { text: string }) => {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all hover:text-primary/80"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
};

export default Linkify;
