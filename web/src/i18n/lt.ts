/**
 * Lithuanian is the source language. Every other language must match this shape
 * (enforced by the `Dict` type). Safety guidance follows lt72.lt
 * "Oro pavojus: ką svarbu žinoti?" — do not add advice that is not there.
 */
export const lt = {
  code: "lt",
  name: "Lietuvių",
  meta: {
    title: "Priedangos – rask artimiausią saugią vietą",
    description:
      "Artimiausia priedanga pagal jūsų vietą, jos darbo laikas ir aiškūs patarimai, ką daryti oro pavojaus metu. Lietuvių, anglų, ukrainiečių, rusų ir lenkų kalbomis.",
  },
  bar: {
    call112: "112",
    call112Label: "Skambinti skubiosios pagalbos numeriu 112",
    textSize: "Teksto dydis",
    language: "Kalba",
    skip: "Pereiti prie paieškos",
  },
  hero: {
    title: "Kur slėptis?",
    calm: "Išlikite ramūs ir veikite nedelsdami. Jūs ne vieni.",
    find: "Rasti artimiausią priedangą",
    findAgain: "Atnaujinti mano vietą",
    privacy: "Jūsų vieta niekur nesiunčiama – atstumai skaičiuojami tik jūsų įrenginyje.",
    locating: "Nustatoma jūsų vieta…",
    denied:
      "Neleidote nustatyti vietos. Įjunkite vietos nustatymą naršyklės nustatymuose arba paspauskite žemėlapyje, kur esate.",
    unavailable: "Vietos nustatyti nepavyko. Bandykite dar kartą arba paspauskite žemėlapyje, kur esate.",
    insecure: "Vietos nustatymas veikia tik saugiu (https) ryšiu. Paspauskite žemėlapyje, kur esate.",
    pickOnMap: "Pasirinkti vietą žemėlapyje",
    pickCancel: "Atšaukti",
    urgentTitle: "Jau gavote RAUDONĄ perspėjimą?",
    urgent:
      "Jei priedanga toli ar užrakinta – nelaukite. Eikite į saugią vietą savo pastate: rūsį arba patalpą be langų, už dviejų sienų.",
    loadingData: "Įkeliamas priedangų sąrašas…",
    dataError: "Nepavyko įkelti priedangų sąrašo. Patikrinkite ryšį ir perkraukite puslapį.",
  },
  results: {
    title: "Artimiausios priedangos",
    fromYou: "Nuo jūsų vietos",
    fromPicked: "Nuo pažymėtos vietos žemėlapyje",
    accuracy: "Vietos tikslumas ±{m} m",
    walk: "~{min} min. pėsčiomis",
    straight: "{d} tiesia linija",
    navigate: "Maršrutas",
    navigateLabel: "Maršrutas: {name} (Google Maps)",
    appleMaps: "Apple Maps",
    showOnMap: "Žemėlapyje",
    capacity: "Talpa: {n} žm.",
    accessible: "Pritaikyta žmonėms su negalia",
    hours: "Paskelbtas darbo laikas: {h}",
    noHours: "Darbo laikas nepaskelbtas",
    nearestOpen: "Artimiausia, kuri pagal duomenis atidaryta dabar:",
    noneOpenNearby: "Per {km} km nėra nė vienos priedangos, apie kurią žinotume, kad ji dabar atidaryta.",
    locked:
      "Užrakinta? Nestovėkite lauke prie durų. Eikite į artimiausio tvirto pastato vidų, už dviejų sienų, arba į kitą priedangą.",
    dataNote:
      "Duomenys – iš oficialaus priedangų registro. Jie gali būti netikslūs, todėl artimiausią priedangą patikrinkite iš anksto, kol pavojaus nėra.",
    more: "Rodyti daugiau",
    selected: "Pasirinkta priedanga",
    close: "Uždaryti",
    unnamed: "Priedanga",
    host: "Pastate: {name}",
    hostHours: "Darbo laikas: {h}",
    hostSource: "Šaltinis: OpenStreetMap",
  },
  status: {
    always: "Atvira visą parą",
    openUntil: "Dabar atvira, iki {time}",
    maybeOpen: "Pagal valandas turėtų būti atvira, iki {time} (dienos nenurodytos)",
    closedOpensToday: "Dabar uždaryta, atsidaro {time}",
    closedOpensTomorrow: "Dabar uždaryta, atsidaro rytoj {time}",
    closedOpensOn: "Dabar uždaryta, atsidaro: {day}, {time}",
    closedByTime: "Pagal darbo laiką dabar uždaryta",
    closedPermanently: "Pažymėta kaip neveikianti",
    not247: "Ne visą parą, darbo laikas nepaskelbtas",
    conflict: "Duomenys prieštaringi, ar atvira – nežinoma",
    unknown: "Nenurodyta, ar atvira – duomenys neužpildyti",
    hostAlways: "Pastate esanti įstaiga dirba visą parą",
    hostOpen: "Pastate esanti įstaiga dabar dirba, iki {time}",
    hostClosed: "Pastate esanti įstaiga dabar nedirba",
  },
  legend: {
    open: "Atvira",
    maybe: "Turėtų būti atvira",
    closed: "Uždaryta",
    limited: "Ne visą parą, valandų nėra",
    nodata: "Duomenų nepateikė",
  },
  legendHelp: {
    open: "Visą parą arba dabar atvira pagal paskelbtą darbo laiką.",
    maybe: "Pagal valandas atvira, bet dienos nenurodytos, arba pastate esanti įstaiga dabar dirba.",
    closed: "Dabar uždaryta pagal paskelbtą darbo laiką arba pažymėta kaip neveikianti.",
    limited: "Pažymėta, kad ne visą parą, bet darbo laikas nepaskelbtas.",
    nodata: "Valdytojas nenurodė nei darbo laiko, nei ar galima patekti visą parą.",
  },
  kinds: {
    underground: "Požeminės perėjos",
    parking: "Požeminės aikštelės ir garažai",
    apartment: "Daugiabučių rūsiai",
    education: "Mokyklos ir darželiai",
    health: "Gydymo ir globos įstaigos",
    shopping: "Prekybos centrai",
    public: "Įstaigos ir viešieji pastatai",
    other: "Kita",
  },
  map: {
    title: "Visos priedangos žemėlapyje",
    search: "Ieškoti",
    searchPlaceholder: "Gatvė, miestas ar pavadinimas",
    status: "Būsena",
    always: "Visą parą",
    accessible: "Pritaikytos negaliai",
    kind: "Tipas",
    allKinds: "Visi tipai",
    shown: "Rodoma {n} iš {total}",
    pickNow: "Paspauskite žemėlapyje, kur esate",
    pickGesture: "Arba žemėlapyje dukart spustelėkite arba ilgai palaikykite pirštą.",
    filtered: "Rodomos ne visos priedangos: {n} iš {total}",
    showAll: "Rodyti visas",
    youAreHere: "Jūs čia",
    picked: "Pažymėta vieta",
    noResults: "Pagal šiuos filtrus priedangų nerasta. Pakeiskite filtrus.",
    reset: "Išvalyti filtrus",
  },
  footer: {
    unofficial: "Neoficiali, nekomercinė svetainė. Oficiali informacija – lt72.lt.",
    data: "Duomenys: PAGD priedangų tinklo registras (open.geodata.gov.lt). Registras atnaujintas {date}.",
    guidance: "Patarimai parengti pagal lt72.lt „Oro pavojus: ką svarbu žinoti?“.",
    emergency: "Skubi pagalba – 112. Konsultacijos visą parą – 1856.",
    offline: "Kartą atidaryta svetainė veikia ir be interneto (žemėlapio fonas gali neįsikelti).",
    map: "Žemėlapis © OpenStreetMap bendruomenė.",
  },
  units: { m: "{n} m", km: "{n} km" },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Dict = Widen<typeof lt>;
