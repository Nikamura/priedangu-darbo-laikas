/** Shelter type, guessed from the name. Used for filtering only, never for safety claims. */
export const KINDS = ["underground", "parking", "apartment", "education", "health", "shopping", "public", "other"] as const;
export type Kind = (typeof KINDS)[number];

const RULES: [Kind, RegExp][] = [
  ["underground", /požemin\S* (pėsčiųjų )?perėj|perėj|tunel/],
  ["parking", /stovėjimo aikštel|statymo aikšt|požemin\S* (automobilių )?aikšt|aikštelė po namu|automobilių saugykl|parking|garaž/],
  ["apartment", /daugiabu[tč]|gyvenam\S* nam|dnsb|bendrij|butų/],
  ["education", /mokykl|gimnazij|licėj|darželi|lopšel|ugdymo|universitet|kolegij|akademij|studentų/],
  ["health", /ligonin|poliklinik|sveikatos|medicin|slaugos|klinik|globos nam/],
  ["shopping", /prekybos|parduotuv|maxima|rimi|\biki\b|lidl|norfa|akropol|ozas|panorama|hipermarket|turgus|turgav/],
  ["public", /savivaldyb|seniūnij|administracij|kultūros|sporto|biblioteka|bažnyč|arena|teatr|muziej|centras|administracin|įstaig|inspekcij|muitin|tarnyb|instituto|ministerij|teism|policij|gelbėjimo/],
];

export function classify(name: string | null, operator: string | null): Kind {
  const text = `${name ?? ""} ${operator ?? ""}`.toLocaleLowerCase("lt");
  const n = (name ?? "").toLocaleLowerCase("lt");
  // The name is more specific than the operator (a school can operate a basement elsewhere).
  for (const [kind, re] of RULES) if (re.test(n)) return kind;
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return "other";
}
