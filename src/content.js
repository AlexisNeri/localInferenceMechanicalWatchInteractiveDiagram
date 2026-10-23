// Human-friendly content for the interactive 3D watch.
// All sentences are kept simple on purpose: this is a didactic tool for everyone.

export const LANGS = { en: "EN", es: "ES" };

function t(en, es) {
  return { en, es };
}

export const UI = {
  title: t("The Mechanical Watch", "El reloj mecánico"),
  subtitle: t("An interactive 3D guide", "Una guía interactiva en 3D"),
  hint: t(
    "Click any part of the watch to learn about it. Drag to spin, scroll to zoom.",
    "Haz clic en cualquier pieza del reloj para conocerla. Arrastra para girar y usa la rueda para acercar."
  ),
  langLabel: "Language / Idioma",
  viewInternals: t("Internals", "Mecanismo"),
  viewExterior: t("Exterior", "Exterior"),
  reset: t("Click empty space to go back to the full watch", "Haz clic en un espacio vacío para volver a la vista completa"),
  loading: t("Assembling the watch…", "Ensamblando el reloj…"),
  fallback:
    t(
      "Sorry, this device can't show 3D graphics. Please open the page on a laptop or desktop computer.",
      "Lo sentimos, tu dispositivo no puede mostrar gráficos 3D. Abre la página en un portátil u ordenador de sobremesa."
    ),
};

export const CONTENT = {
  // ---- movement pieces -------------------------------------------------
  barrel: {
    name: t("Mainspring Barrel", "Tambor del muelle principal"),
    text: t(
      "Think of a little battery with no electricity. You wind it up by turning the crown, and it stores the strength the watch needs to run. Most watches keep their promise for a day or two — slowly letting that energy out through the gears.",
      "Imagina una pequeña pila sin electricidad. La cargas girando la corona y guarda la fuerza que el reloj necesita para funcionar. Suelen durar uno o dos días, soltando esa energía poco a poco a través de los engranajes."
    ),
  },
  centerWheel: {
    name: t("Center Wheel", "Rueda central"),
    text: t(
      "This gear sits in the very middle of the watch and carries the minute hand. The energy from the mainspring flows through it to everything else, and it turns only once every hour — slowly, and never stopping.",
      "Este engranaje está en pleno centro del reloj y sostiene la aguja de los minutos. La energía del muelle pasa por él hacia todas las demás piezas, y solo da una vuelta completa cada hora: despacio, y sin pararse nunca."
    ),
  },
  thirdWheel: {
    name: t("Third Wheel", "Tercera rueda"),
    text: t(
      "One of a row of gears that pass power from the mainspring to the escapement. Each gear turns a little faster than the one before it, stepping the energy up until it reaches the part that counts time.",
      "Es uno de la fila de engranajes que pasa la energía del muelle principal al escape. Cada engranaje gira un poco más rápido que el anterior, hasta que la energía llega a la parte que cuenta los segundos."
    ),
  },
  fourthWheel: {
    name: t("Fourth Wheel", "Cuarta rueda"),
    text: t(
      "This is the wheel that ticks! It turns exactly once per minute, which is why the second hand — attached right above it — sweeps around the face once a minute, all the time.",
      "¡Esta es la rueda que marca el tic-tac! Da una vuelta exacta por minuto, y por eso la aguja de los segundos —que va justo encima de ella— recorre el reloj entero cada minuto, sin descanso."
    ),
  },
  escapeWheel: {
    name: t("Escape Wheel", "Rueda del escape"),
    text: t(
      "A gear with sharp, special teeth that lets power go out in tiny, equal steps: tick… tick… tick. Those little steps are what keep time perfectly even, instead of spinning wildly.",
      "Un engranaje con dientes afilados y especiales que deja salir la energía en puntitos igualetes: tic… tic… tic. Esos pasitos son lo que mantiene el tiempo constante, en lugar de dejar que la energía gire sin control."
    ),
  },
  trainWheel: {
    name: t("Train Wheel", "Rueda del tren de rodaje"),
    text: t(
      "A helper gear on the way from the mainspring to the ticking wheel. Watches have a small “train” of several gears, and each one is like a relay runner handing the baton of energy to the next.",
      "Un engranaje de apoyo en el camino entre el muelle principal y la rueda que marca el tiempo. Los relojes tienen un pequeño «tren» de varios engranajes, y cada uno es como un corredor de relevo que pasa la energía al siguiente."
    ),
  },
  palletFork: {
    name: t("Pallet Fork", "Áncora del escape"),
    text: t(
      "A tiny lever named because it looks a bit like an anchor. It holds the escape wheel, then releases it with one click, then holds it again… over and over, thousands of times a day. That steady rhythm is the watch's heartbeat.",
      "Una palanquita que lleva ese nombre porque se parece a un ancla. Sostiene la rueda del escape, luego la suelta con un clic, y luego la vuelve a sostener… una y otra vez, miles de veces al día. Ese ritmo constante es el latido del reloj."
    ),
  },
  balance: {
    name: t("Balance Wheel", "Balancín"),
    text: t(
      "The heart of the watch: a little coin that swings back and forth like a metronome. It keeps perfect time because, no matter how far it swings, it always takes the same amount of time to swing back.",
      "El corazón del reloj: una monedita que oscila de un lado a otro como un metrónomo. Mantiene un tiempo perfecto porque, sin importar cuánto se mueva, siempre le lleva la misma cantidad de tiempo volver al centro."
    ),
  },
  balanceSpring: {
    name: t("Balance Spring", "Muelle de espiral (hairspring)"),
    text: t(
      "A spring so thin it's almost invisible, coiled in the middle of the balance wheel. It pulls the wheel back to its center like an elastic band, making the swinging metronome steady and precise.",
      "Un resorte tan fino que casi no se ve, enroscado en el centro del balancín. Devuelve la ruedita al centro como si fuera una liga elástica, haciendo que su balanceo sea constante y preciso."
    ),
  },
  crown: {
    name: t("Crown", "Corona"),
    text: t(
      "The little knob on the side. Turn it and the mainspring winds up, storing energy that keeps the watch alive for a day or more. It is like the fuel pump — the one thing a mechanical watch needs from you.",
      "El botoncito del lateral. Al girarlo se carga el muelle principal y se guarda la energía que mantiene vivo al reloj durante un día o más. Es como la bomba de combustible: lo único que un reloj mecánico necesita de ti."
    ),
  },
  // ---- case pieces ------------------------------------------------------
  casebody: {
    name: t("Case", "Caja"),
    text: t(
      "The round “body” of the watch that holds everything together. It protects the delicate movement inside from dust, knocks and water, and it is also what makes the watch look the way it looks.",
      "Es el «cuerpo» redondo del reloj que lo mantiene todo unido. Protege el delicado mecanismo interior del polvo, los golpes y el agua, y además es lo que le da al reloj su forma y su estilo."
    ),
  },
  crystal: {
    name: t("Crystal", "Cristal"),
    text: t(
      "The clear top that lets you look at the watch. Real ones are usually sapphire — the kind that barely scratches on window glass — and many have a curved shape to make the face easier to read.",
      "La parte transparente de arriba por donde miras el reloj. Los de verdad están hechos de zafiro, un material casi imposible de rayar, y suelen tener una forma curva para que se lea mejor."
    ),
  },
  dial: {
    name: t("Dial", "Esfera o cuadrante"),
    text: t(
      "The face of the watch: the part with the numbers and marks. The hands move in front of it and it tells you where they are. It is the only part you actually “read” when checking the time.",
      "Es la cara del reloj: la parte de los números y las marcas. Las agujas se mueven frente a ella y te dicen en qué número están. Es la única que miras de verdad al consultar la hora."
    ),
  },
  hands: {
    name: t("Hands", "Agujas"),
    text: t(
      "The two moving pointers: the long one counts minutes and the short one counts hours (the thin needle is the second hand). Everything the gears do inside finally shows up right here, for you to see.",
      "Los dos punteros que se mueven: el largo cuenta los minutos y el corto las horas (la aguja fina es la de los segundos). Todo lo que hacen por dentro los engranajes termina mostrándose aquí, para que tú lo veas."
    ),
  },
};
