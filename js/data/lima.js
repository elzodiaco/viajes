/*
 * Datos de Lima para el planificador.
 * Horarios aproximados: cambian según temporada y feriados, por eso la página
 * recomienda confirmarlos antes de ir.
 *
 * hours: arreglo de 7 posiciones (0 = domingo ... 6 = sábado), cada una
 *        ["HH:MM", "HH:MM"] o null si está cerrado.
 * cost:  precio aproximado de entrada por persona en soles (S/).
 * priority: 1-10, qué tan imprescindible es para un primer viaje.
 */
(function () {
  function week(open, close, closedDays, overrides) {
    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push(closedDays && closedDays.indexOf(i) !== -1 ? null : [open, close]);
    }
    if (overrides) {
      Object.keys(overrides).forEach(function (k) { days[k] = overrides[k]; });
    }
    return days;
  }

  window.CITIES = window.CITIES || {};

  window.CITIES.lima = {
    id: "lima",
    name: { es: "Lima", en: "Lima" },
    currency: "S/",
    airport: {
      name: { es: "Aeropuerto Internacional Jorge Chávez", en: "Jorge Chávez International Airport" },
      lat: -12.0219, lng: -77.1143
    },

    zones: {
      miraflores: { name: { es: "Miraflores", en: "Miraflores" }, lat: -12.1211, lng: -77.0297, hotel: true,
        free: { es: "Pasea por el Malecón o el Parque Kennedy y tómate un café.", en: "Stroll the Malecón or Parque Kennedy and grab a coffee." } },
      barranco: { name: { es: "Barranco", en: "Barranco" }, lat: -12.1490, lng: -77.0215, hotel: true,
        free: { es: "Recorre las calles bohemias, los murales y las galerías de Barranco.", en: "Wander Barranco's bohemian streets, murals and galleries." } },
      sanisidro: { name: { es: "San Isidro", en: "San Isidro" }, lat: -12.0977, lng: -77.0365, hotel: true,
        free: { es: "Relájate en el Bosque El Olivar o en una cafetería de la zona.", en: "Relax at El Olivar park or a local café." } },
      centro: { name: { es: "Centro Histórico", en: "Historic Center" }, lat: -12.0464, lng: -77.0300, hotel: true,
        free: { es: "Camina por el Jirón de la Unión y admira los balcones coloniales.", en: "Walk Jirón de la Unión and admire the colonial balconies." } },
      callao: { name: { es: "Callao / Aeropuerto", en: "Callao / Airport" }, lat: -12.0300, lng: -77.1050, hotel: true,
        free: { es: "Descansa en el hotel o acércate a La Punta para ver el mar.", en: "Rest at the hotel or head to La Punta to see the ocean." } },
      pueblolibre: { name: { es: "Pueblo Libre", en: "Pueblo Libre" }, lat: -12.0727, lng: -77.0705,
        free: { es: "Visita la antigua Taberna Queirolo, un clásico del barrio.", en: "Visit the old Taberna Queirolo, a neighborhood classic." } },
      surquillo: { name: { es: "Surquillo", en: "Surquillo" }, lat: -12.1124, lng: -77.0270,
        free: { es: "Prueba frutas peruanas en el mercado.", en: "Try Peruvian fruits at the market." } },
      chorrillos: { name: { es: "Chorrillos", en: "Chorrillos" }, lat: -12.1650, lng: -77.0270,
        free: { es: "Mira el atardecer desde la playa Agua Dulce.", en: "Watch the sunset from Agua Dulce beach." } },
      pachacamac: { name: { es: "Pachacamac", en: "Pachacamac" }, lat: -12.2569, lng: -76.9003,
        free: { es: "Disfruta del campo en Pachacamac.", en: "Enjoy the countryside in Pachacamac." } }
    },

    attractions: [
      {
        id: "plaza-mayor", kids: true, zone: "centro", lat: -12.0464, lng: -77.0300,
        name: { es: "Plaza Mayor y Palacio de Gobierno", en: "Plaza Mayor & Government Palace" },
        desc: { es: "El corazón de la Lima colonial, Patrimonio de la Humanidad. Rodeada por la Catedral, el Palacio de Gobierno y la Municipalidad.", en: "The heart of colonial Lima, a UNESCO World Heritage site, framed by the Cathedral, Government Palace and City Hall." },
        tip: { es: "El cambio de guardia suele ser cerca del mediodía; llega unos minutos antes.", en: "The changing of the guard usually happens around noon; arrive a few minutes early." },
        interests: ["history"], priority: 10, duration: 45, cost: 0,
        hours: week("08:00", "20:00")
      },
      {
        id: "catedral", zone: "centro", lat: -12.0459, lng: -77.0297,
        name: { es: "Catedral de Lima", en: "Lima Cathedral" },
        desc: { es: "Catedral del siglo XVI con la tumba de Francisco Pizarro y un museo de arte religioso.", en: "16th-century cathedral holding Francisco Pizarro's tomb and a religious art museum." },
        interests: ["history", "art"], priority: 7, duration: 60, cost: 30,
        hours: week("09:00", "17:00", [], { 0: ["13:30", "17:00"], 6: ["10:00", "13:00"] })
      },
      {
        id: "san-francisco", zone: "centro", lat: -12.0453, lng: -77.0273,
        name: { es: "Convento de San Francisco y Catacumbas", en: "San Francisco Monastery & Catacombs" },
        desc: { es: "Biblioteca antigua impresionante y catacumbas con miles de restos óseos. Visita guiada.", en: "A stunning ancient library and catacombs holding thousands of bones. Guided tour." },
        interests: ["history", "art"], priority: 9, duration: 60, cost: 15,
        hours: week("09:00", "18:00")
      },
      {
        id: "santo-domingo", zone: "centro", lat: -12.0450, lng: -77.0310,
        name: { es: "Convento de Santo Domingo", en: "Santo Domingo Monastery" },
        desc: { es: "Claustros con azulejos sevillanos y los restos de Santa Rosa de Lima y San Martín de Porres.", en: "Cloisters with Sevillian tiles and the relics of Saint Rose of Lima and Saint Martin de Porres." },
        interests: ["history", "art"], priority: 5, duration: 45, cost: 15,
        hours: week("09:30", "17:30", [], { 0: ["10:00", "13:00"] })
      },
      {
        id: "cerro-san-cristobal", zone: "centro", lat: -12.0347, lng: -77.0186,
        name: { es: "Mirador del Cerro San Cristóbal", en: "San Cristóbal Hill Lookout" },
        desc: { es: "La mejor vista panorámica de Lima. Se sube en bus turístico desde la Plaza Mayor.", en: "The best panoramic view of Lima. Reached by tourist bus from Plaza Mayor." },
        tip: { es: "Sube en el bus turístico oficial; no subas caminando por tu cuenta.", en: "Take the official tourist bus; don't walk up on your own." },
        interests: ["nature", "history"], priority: 5, duration: 75, cost: 10,
        hours: week("10:00", "17:00")
      },
      {
        id: "barrio-chino", zone: "centro", lat: -12.0500, lng: -77.0265,
        name: { es: "Barrio Chino y Mercado Central", en: "Chinatown & Central Market" },
        desc: { es: "Mercado bullicioso y el barrio chino más antiguo de América. Cuna de la comida chifa.", en: "A bustling market and the oldest Chinatown in the Americas, birthplace of chifa cuisine." },
        tip: { es: "Lleva poco efectivo y cuida tus pertenencias en la multitud.", en: "Carry little cash and watch your belongings in the crowds." },
        interests: ["gastronomy", "shopping"], priority: 5, duration: 60, cost: 0,
        hours: week("09:00", "18:00")
      },
      {
        id: "casa-literatura", zone: "centro", lat: -12.0437, lng: -77.0290,
        name: { es: "Casa de la Literatura Peruana", en: "House of Peruvian Literature" },
        desc: { es: "Funciona en la hermosa antigua Estación de Desamparados. Entrada libre.", en: "Housed in the beautiful old Desamparados train station. Free entry." },
        interests: ["art", "history"], priority: 3, duration: 45, cost: 0,
        hours: week("10:00", "19:00", [1])
      },
      {
        id: "mali", zone: "centro", lat: -12.0603, lng: -77.0369,
        name: { es: "MALI – Museo de Arte de Lima", en: "MALI – Lima Art Museum" },
        desc: { es: "3,000 años de arte peruano en un palacio del siglo XIX dentro del Parque de la Exposición.", en: "3,000 years of Peruvian art in a 19th-century palace inside Parque de la Exposición." },
        interests: ["art", "history"], priority: 6, duration: 90, cost: 30,
        hours: week("10:00", "19:00", [1], { 6: ["10:00", "17:00"] })
      },
      {
        id: "circuito-magico", kids: true, romantic: true, zone: "centro", lat: -12.0702, lng: -77.0335,
        name: { es: "Circuito Mágico del Agua", en: "Magic Water Circuit" },
        desc: { es: "Parque con fuentes iluminadas y un espectáculo de luces, música y agua por la noche.", en: "A park of illuminated fountains with a nighttime show of lights, music and water." },
        tip: { es: "Los espectáculos principales son al anochecer. Lleva ropa de cambio si te mojas en el túnel.", en: "The main shows start after dark. Bring spare clothes if you'll walk through the water tunnel." },
        interests: ["nature", "art"], priority: 7, duration: 90, cost: 4, evening: true,
        hours: week("15:00", "22:30", [1, 2])
      },
      {
        id: "larco", kids: true, zone: "pueblolibre", lat: -12.0727, lng: -77.0705,
        name: { es: "Museo Larco", en: "Larco Museum" },
        desc: { es: "La mejor colección de arte precolombino del Perú, en una casona virreinal con jardines. Incluye la famosa galería erótica.", en: "Peru's finest pre-Columbian art collection in a colonial mansion with gardens, including the famous erotic gallery." },
        interests: ["history", "art"], priority: 9, duration: 120, cost: 35,
        hours: week("09:00", "22:00")
      },
      {
        id: "huaca-pucllana", kids: true, zone: "miraflores", lat: -12.1109, lng: -77.0337,
        name: { es: "Huaca Pucllana", en: "Huaca Pucllana" },
        desc: { es: "Pirámide de adobe de 1,500 años de antigüedad en medio de Miraflores. Visita guiada.", en: "A 1,500-year-old adobe pyramid in the middle of Miraflores. Guided tour." },
        interests: ["history"], priority: 8, duration: 60, cost: 15,
        hours: week("09:00", "17:00", [2])
      },
      {
        id: "malecon", kids: true, romantic: true, zone: "miraflores", lat: -12.1278, lng: -77.0339,
        name: { es: "Malecón de Miraflores y Parque del Amor", en: "Miraflores Boardwalk & Love Park" },
        desc: { es: "Paseo sobre los acantilados frente al Pacífico. Ideal al atardecer.", en: "A cliff-top walk above the Pacific. Best at sunset." },
        interests: ["nature", "beach"], priority: 9, duration: 75, cost: 0, sunset: true,
        hours: week("06:00", "22:00")
      },
      {
        id: "larcomar", kids: true, zone: "miraflores", lat: -12.1318, lng: -77.0303,
        name: { es: "Larcomar", en: "Larcomar" },
        desc: { es: "Centro comercial construido en el acantilado, con vista al mar, tiendas y restaurantes.", en: "A shopping mall built into the cliff, with ocean views, shops and restaurants." },
        interests: ["shopping"], priority: 4, duration: 60, cost: 0,
        hours: week("11:00", "22:00")
      },
      {
        id: "mercado-indio", zone: "miraflores", lat: -12.1145, lng: -77.0286,
        name: { es: "Mercado Indio (Av. Petit Thouars)", en: "Indian Market (Petit Thouars Ave.)" },
        desc: { es: "Las mejores tiendas de artesanía de Lima: alpaca, textiles, cerámica y recuerdos.", en: "Lima's best craft stalls: alpaca, textiles, pottery and souvenirs." },
        tip: { es: "Compara precios y regatea con amabilidad.", en: "Compare prices and bargain politely." },
        interests: ["shopping"], priority: 5, duration: 60, cost: 0,
        hours: week("10:00", "20:00")
      },
      {
        id: "parapente", zone: "miraflores", lat: -12.1258, lng: -77.0365,
        name: { es: "Vuelo en parapente sobre la Costa Verde", en: "Paragliding over the Costa Verde" },
        desc: { es: "Vuelo en tándem de unos 10–15 minutos sobre los acantilados de Miraflores.", en: "A 10–15 minute tandem flight over the Miraflores cliffs." },
        tip: { es: "Depende del viento; si no hay condiciones, ve al malecón y vuelve más tarde.", en: "Weather dependent; if conditions are poor, enjoy the boardwalk and try later." },
        interests: ["adventure"], priority: 4, duration: 60, cost: 270,
        hours: week("10:00", "17:00")
      },
      {
        id: "surf", kids: true, zone: "miraflores", lat: -12.1250, lng: -77.0390,
        name: { es: "Clase de surf en la Costa Verde", en: "Surf lesson at the Costa Verde" },
        desc: { es: "Clase para principiantes en las playas Makaha o Waikiki, con tabla y traje incluidos.", en: "A beginner lesson at Makaha or Waikiki beach, board and wetsuit included." },
        interests: ["beach", "adventure"], priority: 4, duration: 120, cost: 120,
        hours: week("08:00", "16:00")
      },
      {
        id: "mercado-surquillo", zone: "surquillo", lat: -12.1124, lng: -77.0270,
        name: { es: "Mercado de Surquillo", en: "Surquillo Market" },
        desc: { es: "Mercado de abastos favorito de los chefs: frutas exóticas, ajíes y cevicherías.", en: "Chefs' favorite food market: exotic fruits, chili peppers and ceviche stalls." },
        interests: ["gastronomy"], priority: 5, duration: 60, cost: 0,
        hours: week("08:00", "16:00")
      },
      {
        id: "clase-cocina", kids: true, zone: "miraflores", lat: -12.1200, lng: -77.0310,
        name: { es: "Clase de cocina peruana y pisco sour", en: "Peruvian cooking & pisco sour class" },
        desc: { es: "Aprende a preparar ceviche, lomo saltado y pisco sour; muchas incluyen visita al mercado.", en: "Learn to make ceviche, lomo saltado and pisco sour; many include a market visit." },
        tip: { es: "Reserva con uno o dos días de anticipación.", en: "Book one or two days in advance." },
        interests: ["gastronomy"], priority: 5, duration: 180, cost: 250, replacesMeal: true,
        hours: week("10:00", "18:00")
      },
      {
        id: "barranco-puente", romantic: true, zone: "barranco", lat: -12.1497, lng: -77.0222,
        name: { es: "Puente de los Suspiros y Bajada de Baños", en: "Bridge of Sighs & Bajada de Baños" },
        desc: { es: "El rincón más romántico de Barranco: casonas coloridas, murales y la bajada al mar.", en: "Barranco's most romantic corner: colorful mansions, murals and the path down to the sea." },
        interests: ["art", "history", "nightlife"], priority: 8, duration: 75, cost: 0, sunset: true,
        hours: week("08:00", "22:00")
      },
      {
        id: "mate", zone: "barranco", lat: -12.1455, lng: -77.0217,
        name: { es: "MATE – Museo Mario Testino", en: "MATE – Mario Testino Museum" },
        desc: { es: "Museo del famoso fotógrafo peruano, con exposiciones temporales en una casona barranquina.", en: "Museum of the famous Peruvian photographer, with rotating exhibits in a Barranco mansion." },
        interests: ["art"], priority: 5, duration: 60, cost: 30,
        hours: week("11:00", "19:00", [1])
      },
      {
        id: "mac", zone: "barranco", lat: -12.1420, lng: -77.0215,
        name: { es: "MAC Lima – Museo de Arte Contemporáneo", en: "MAC Lima – Contemporary Art Museum" },
        desc: { es: "Arte contemporáneo peruano y latinoamericano en un edificio moderno rodeado de jardines.", en: "Contemporary Peruvian and Latin American art in a modern building surrounded by gardens." },
        interests: ["art"], priority: 4, duration: 60, cost: 15,
        hours: week("10:00", "19:00", [1])
      },
      {
        id: "huaca-huallamarca", zone: "sanisidro", lat: -12.0948, lng: -77.0451,
        name: { es: "Huaca Huallamarca", en: "Huaca Huallamarca" },
        desc: { es: "Pirámide preinca restaurada en pleno San Isidro, con un pequeño museo.", en: "A restored pre-Inca pyramid in the middle of San Isidro, with a small museum." },
        interests: ["history"], priority: 3, duration: 45, cost: 10,
        hours: week("09:00", "17:00", [1])
      },
      {
        id: "olivar", kids: true, zone: "sanisidro", lat: -12.0985, lng: -77.0350,
        name: { es: "Bosque El Olivar", en: "El Olivar Park" },
        desc: { es: "Olivar centenario, con árboles traídos en la época colonial. Un respiro verde en la ciudad.", en: "A centuries-old olive grove dating to colonial times; a green escape in the city." },
        interests: ["nature"], priority: 4, duration: 45, cost: 0,
        hours: week("07:00", "19:00")
      },
      {
        id: "chorrillos", zone: "chorrillos", lat: -12.1650, lng: -77.0270,
        name: { es: "Muelle de pescadores de Chorrillos y Morro Solar", en: "Chorrillos Fishermen's Wharf & Morro Solar" },
        desc: { es: "Mira llegar la pesca del día y sube al Morro Solar para ver toda la bahía de Lima.", en: "Watch the day's catch come in and head up Morro Solar for a view over Lima's bay." },
        interests: ["beach", "gastronomy", "nature"], priority: 4, duration: 90, cost: 0,
        hours: week("08:00", "17:30")
      },
      {
        id: "callao-monumental", zone: "callao", lat: -12.0560, lng: -77.1500,
        name: { es: "Callao Monumental y La Punta", en: "Callao Monumental & La Punta" },
        desc: { es: "Edificios históricos llenos de arte urbano, galerías y el tranquilo malecón de La Punta.", en: "Historic buildings full of street art, galleries and the peaceful La Punta waterfront." },
        tip: { es: "Ve en taxi o con tour y quédate en la zona turística.", en: "Go by taxi or on a tour and stay inside the tourist area." },
        interests: ["art", "beach"], priority: 4, duration: 120, cost: 0,
        hours: week("10:00", "18:00")
      },
      {
        id: "palomino", kids: true, zone: "callao", lat: -12.0647, lng: -77.1528,
        name: { es: "Islas Palomino: nado con lobos marinos", en: "Palomino Islands: swim with sea lions" },
        desc: { es: "Paseo en bote desde el Callao para nadar con lobos marinos y ver aves guaneras.", en: "A boat trip from Callao to swim with sea lions and see seabirds." },
        tip: { es: "Reserva el tour con anticipación; el mar puede estar movido.", en: "Book the tour in advance; the sea can be rough." },
        interests: ["nature", "adventure", "beach"], priority: 6, duration: 240, cost: 150,
        fixedStart: "10:00", dayTrip: true,
        hours: week("10:00", "14:00")
      },
      {
        id: "pachacamac", zone: "pachacamac", lat: -12.2569, lng: -76.9003,
        name: { es: "Santuario arqueológico de Pachacamac", en: "Pachacamac archaeological sanctuary" },
        desc: { es: "Gran centro ceremonial preinca e inca frente al mar, a una hora al sur de Lima.", en: "A vast pre-Inca and Inca ceremonial center by the sea, an hour south of Lima." },
        tip: { es: "Lleva agua, gorra y protector solar.", en: "Bring water, a hat and sunscreen." },
        interests: ["history"], priority: 6, duration: 180, cost: 15, dayTrip: true,
        hours: week("09:00", "17:00", [1], { 0: ["09:00", "16:00"] })
      },
      {
        id: "barranco-noche", zone: "barranco", lat: -12.1490, lng: -77.0210,
        name: { es: "Noche de bares y peñas en Barranco", en: "Bars and live music in Barranco" },
        desc: { es: "Bares de pisco, música criolla en vivo y peñas en el barrio más bohemio de Lima.", en: "Pisco bars, live Creole music and peñas in Lima's most bohemian district." },
        tip: { es: "Regresa en taxi por aplicativo.", en: "Get back by ride-hailing app." },
        interests: ["nightlife"], priority: 4, duration: 120, cost: 60, night: true,
        hours: week("20:00", "23:59")
      },
      {
        id: "miraflores-noche", zone: "miraflores", lat: -12.1205, lng: -77.0295,
        name: { es: "Bares y coctelería en Miraflores", en: "Bars and cocktails in Miraflores" },
        desc: { es: "Calle de las Pizzas, bares de cócteles con pisco y discotecas cerca del Parque Kennedy.", en: "Calle de las Pizzas, pisco cocktail bars and clubs near Parque Kennedy." },
        interests: ["nightlife"], priority: 3, duration: 120, cost: 60, night: true,
        hours: week("20:00", "23:59")
      }
    ],

    /* price: 1 = económico, 2 = medio, 3 = alto. cost: gasto aprox. por persona (S/). */
    restaurants: [
      { id: "central", adultsOnly: true, duration: 180, name: "Central", zone: "barranco", lat: -12.1487, lng: -77.0218, price: 3, cost: 1500, meals: ["lunch", "dinner"], famous: true, reservation: true,
        desc: { es: "Menú degustación de Virgilio Martínez que recorre los ecosistemas del Perú.", en: "Virgilio Martínez's tasting menu journeying through Peru's ecosystems." } },
      { id: "maido", adultsOnly: true, duration: 150, name: "Maido", zone: "miraflores", lat: -12.1220, lng: -77.0300, price: 3, cost: 1100, meals: ["lunch", "dinner"], famous: true, reservation: true,
        desc: { es: "Cocina nikkei (peruano-japonesa) de Mitsuharu Tsumura.", en: "Mitsuharu Tsumura's Nikkei (Peruvian-Japanese) cuisine." } },
      { id: "astrid", duration: 150, name: "Astrid y Gastón", zone: "sanisidro", lat: -12.0960, lng: -77.0390, price: 3, cost: 450, meals: ["lunch", "dinner"], famous: true, reservation: true,
        desc: { es: "El restaurante que inició el boom gastronómico peruano, en una casa hacienda.", en: "The restaurant that sparked Peru's food boom, in a colonial hacienda house." } },
      { id: "rafael", adultsOnly: true, duration: 120, name: "Rafael", zone: "miraflores", lat: -12.1205, lng: -77.0355, price: 3, cost: 350, meals: ["dinner"], reservation: true,
        desc: { es: "Cocina peruana contemporánea con influencias mediterráneas.", en: "Contemporary Peruvian cuisine with Mediterranean touches." } },
      { id: "pucllana-rest", name: "Restaurante Huaca Pucllana", zone: "miraflores", lat: -12.1105, lng: -77.0330, price: 3, cost: 180, meals: ["lunch", "dinner"], reservation: true,
        desc: { es: "Cena con vista a la pirámide iluminada.", en: "Dinner overlooking the illuminated pyramid." } },
      { id: "la-mar", seafood: true, name: "La Mar Cebichería", zone: "miraflores", lat: -12.1100, lng: -77.0450, price: 2, cost: 140, meals: ["lunch"], famous: true,
        desc: { es: "La cebichería de Gastón Acurio; los mejores ceviches y tiraditos.", en: "Gastón Acurio's cevichería; top ceviches and tiraditos." } },
      { id: "isolina", name: "Isolina", zone: "barranco", lat: -12.1478, lng: -77.0205, price: 2, cost: 110, meals: ["lunch", "dinner"], famous: true,
        desc: { es: "Taberna criolla con porciones generosas para compartir.", en: "A Creole tavern with generous sharing plates." } },
      { id: "canta-rana", seafood: true, name: "Canta Rana", zone: "barranco", lat: -12.1480, lng: -77.0210, price: 2, cost: 80, meals: ["lunch"],
        desc: { es: "Cevichería de barrio con mucho ambiente y fotos de fútbol.", en: "A lively neighborhood cevichería covered in football photos." } },
      { id: "punto-azul", seafood: true, name: "Punto Azul", zone: "miraflores", lat: -12.1215, lng: -77.0300, price: 2, cost: 70, meals: ["lunch"],
        desc: { es: "Ceviches abundantes y jaleas a buen precio. Llega temprano, se llena.", en: "Generous ceviches and fried seafood at fair prices. Arrive early, it fills up." } },
      { id: "panchita", name: "Panchita", zone: "miraflores", lat: -12.1190, lng: -77.0340, price: 2, cost: 110, meals: ["lunch", "dinner"],
        desc: { es: "Anticuchos, carnes a la brasa y cocina criolla.", en: "Anticuchos, grilled meats and Creole classics." } },
      { id: "barra-chalaca", seafood: true, name: "Barra Chalaca", zone: "miraflores", lat: -12.1160, lng: -77.0420, price: 2, cost: 80, meals: ["lunch", "dinner"],
        desc: { es: "Barra marina informal con ceviches, causas y chicharrón de pescado.", en: "A casual seafood bar for ceviche, causa and fried fish." } },
      { id: "la-lucha", name: "La Lucha Sanguchería", zone: "miraflores", lat: -12.1213, lng: -77.0302, price: 1, cost: 35, meals: ["lunch", "dinner"],
        desc: { es: "Sánguches criollos de chicharrón y pavo, y jugos naturales.", en: "Creole pork and turkey sandwiches with fresh juices." } },
      { id: "pardos", name: "Pardos Chicken", zone: "miraflores", lat: -12.1230, lng: -77.0290, price: 1, cost: 50, meals: ["lunch", "dinner"],
        desc: { es: "Pollo a la brasa, el plato más popular del Perú.", en: "Pollo a la brasa, Peru's most popular dish." } },
      { id: "juanito", name: "Juanito de Barranco", zone: "barranco", lat: -12.1493, lng: -77.0205, price: 1, cost: 40, meals: ["lunch", "dinner"],
        desc: { es: "Bar-bodega histórico con sánguches de jamón del país.", en: "A historic bar known for local ham sandwiches." } },
      { id: "el-chinito", name: "El Chinito", zone: "centro", lat: -12.0475, lng: -77.0335, price: 1, cost: 35, meals: ["lunch"],
        desc: { es: "Sánguches de chicharrón y jamón del país desde 1960.", en: "Pork and ham sandwiches since 1960." } },
      { id: "cordano", name: "Bar Cordano", zone: "centro", lat: -12.0452, lng: -77.0302, price: 1, cost: 60, meals: ["lunch"],
        desc: { es: "Bar centenario frente a Palacio de Gobierno; cocina criolla y pisco.", en: "A century-old bar facing the Government Palace; Creole food and pisco." } },
      { id: "wa-lok", name: "Chifa Wa Lok", zone: "centro", lat: -12.0503, lng: -77.0268, price: 2, cost: 80, meals: ["lunch", "dinner"],
        desc: { es: "Clásico chifa del Barrio Chino, famoso por sus dim sum.", en: "A classic Chinatown chifa, famous for its dim sum." } },
      { id: "san-joy-lao", name: "Chifa San Joy Lao", zone: "centro", lat: -12.0498, lng: -77.0262, price: 1, cost: 50, meals: ["lunch", "dinner"],
        desc: { es: "Chifa tradicional del Barrio Chino: arroz chaufa, wantán y pato asado.", en: "A traditional Chinatown chifa: fried rice, wontons and roast duck." } },
      { id: "tanta-centro", name: "Tanta", zone: "centro", lat: -12.0455, lng: -77.0315, price: 2, cost: 75, meals: ["lunch", "dinner"],
        desc: { es: "Cocina peruana casual de Gastón Acurio, a pasos de la Plaza Mayor.", en: "Gastón Acurio's casual Peruvian kitchen, steps from Plaza Mayor." } },
      { id: "queirolo", name: "Antigua Taberna Queirolo", zone: "pueblolibre", lat: -12.0745, lng: -77.0640, price: 1, cost: 55, meals: ["lunch", "dinner"],
        desc: { es: "Taberna de 1880 con pisco propio, butifarras y música criolla.", en: "An 1880 tavern with house pisco, butifarra sandwiches and Creole music." } },
      { id: "cafe-larco", name: "Café del Museo Larco", zone: "pueblolibre", lat: -12.0729, lng: -77.0702, price: 2, cost: 110, meals: ["lunch", "dinner"],
        desc: { es: "Cocina peruana en la terraza florida del museo.", en: "Peruvian cuisine on the museum's flower-filled terrace." } },
      { id: "surquillo-cevicheria", seafood: true, name: { es: "Cevicherías del Mercado de Surquillo", en: "Surquillo Market ceviche stalls" }, zone: "surquillo", lat: -12.1124, lng: -77.0270, price: 1, cost: 35, meals: ["lunch"],
        desc: { es: "Ceviche fresco y barato como lo comen los limeños.", en: "Fresh, cheap ceviche the way locals eat it." } },
      { id: "chorrillos-muelle", seafood: true, name: { es: "Cevicherías del muelle de Chorrillos", en: "Chorrillos wharf seafood stalls" }, zone: "chorrillos", lat: -12.1655, lng: -77.0275, price: 1, cost: 40, meals: ["lunch"],
        desc: { es: "Pescado del día recién llegado del mar.", en: "Catch of the day straight off the boats." } },
      { id: "la-punta-rest", seafood: true, name: { es: "Cevicherías de La Punta", en: "La Punta seafood restaurants" }, zone: "callao", lat: -12.0715, lng: -77.1620, price: 2, cost: 80, meals: ["lunch"],
        desc: { es: "Comida marina chalaca con vista al mar.", en: "Callao-style seafood with ocean views." } },
      { id: "pachacamac-campestre", name: { es: "Restaurante campestre en Pachacamac", en: "Countryside restaurant in Pachacamac" }, zone: "pachacamac", lat: -12.2400, lng: -76.8700, price: 2, cost: 70, meals: ["lunch"],
        desc: { es: "Chicharrón, pachamanca y comida criolla al aire libre.", en: "Fried pork, pachamanca and Creole food outdoors." } },
      { id: "airport-food", name: { es: "Comida en el aeropuerto / hotel", en: "Airport or hotel dining" }, zone: "callao", lat: -12.0250, lng: -77.1100, price: 2, cost: 70, meals: ["lunch", "dinner"],
        desc: { es: "Opción práctica cerca del aeropuerto.", en: "A practical option near the airport." } }
    ],

    /*
     * Tours que la página ofrece. El precio está en dólares (así lo vende el
     * operador) y se convierte a soles con el tipo de cambio de los ajustes.
     * "covers" son atracciones que el tour ya visita: no se repiten en el plan.
     */
    tours: [
      {
        id: "city-tour-plus", provider: "Lima VIP Travel",
        name: { es: "Lima City Tour Plus + video con dron", en: "Lima City Tour Plus + drone video" },
        desc: {
          es: "Tour guiado de 4 horas por lo más icónico de Lima, con un video grabado con dron que te entregan editado de regalo.",
          en: "A 4-hour guided tour of Lima's icons, with a drone video edited and given to you as a gift."
        },
        stops: [
          { es: "Parque del Amor, frente al Pacífico (video con dron)", en: "Love Park, overlooking the Pacific (drone video)" },
          { es: "Parque Intihuatana", en: "Intihuatana Park" },
          { es: "Huaca Pucllana desde un mirador panorámico, con helado artesanal", en: "Huaca Pucllana from a panoramic viewpoint, with artisan ice cream" },
          { es: "Bosque El Olivar de San Isidro", en: "El Olivar olive grove in San Isidro" },
          { es: "Museo del Banco Central de Reserva (BCR)", en: "Central Reserve Bank Museum (BCR)" },
          { es: "Plaza de Armas y Centro Histórico", en: "Plaza de Armas and the Historic Center" }
        ],
        includes: {
          es: "Guía en español e inglés, transporte, entradas, video con dron y degustaciones. Grupos de hasta 13 personas.",
          en: "English and Spanish-speaking guide, transport, entrance fees, drone video and tastings. Groups of up to 13."
        },
        tip: {
          es: "El Museo del BCR cierra domingos y lunes; esos días el recorrido puede variar.",
          en: "The BCR Museum is closed on Sundays and Mondays; the route may vary on those days."
        },
        priceUsd: 38, duration: 240, departures: ["09:00", "14:00"],
        start: { lat: -12.1278, lng: -77.0339 }, end: { lat: -12.0464, lng: -77.0300, zone: "centro" },
        covers: ["malecon", "huaca-pucllana", "olivar", "plaza-mayor"],
        url: "https://limaviptravel.pe/en/tours/lima-city-tour-plus-2/"
      }
    ],

    tips: [
      { es: "Usa taxis por aplicativo (Uber, Cabify, InDrive) en vez de tomar taxis en la calle.", en: "Use ride-hailing apps (Uber, Cabify, InDrive) instead of hailing taxis on the street." },
      { es: "El tráfico de Lima es pesado: entre 7–9 h y 17–20 h los traslados pueden tardar el doble.", en: "Lima traffic is heavy: between 7–9 am and 5–8 pm trips can take twice as long." },
      { es: "No tomes agua del caño; compra agua embotellada.", en: "Don't drink tap water; buy bottled water." },
      { es: "En Lima el almuerzo es la comida principal y las cevicherías suelen cerrar a las 17 h.", en: "Lunch is the main meal in Lima and cevicherías usually close around 5 pm." },
      { es: "De junio a octubre el cielo está nublado (garúa); de diciembre a marzo hace calor y sol.", en: "June to October is grey and misty (garúa); December to March is hot and sunny." },
      { es: "Lleva soles en efectivo para mercados y propinas; en restaurantes se aceptan tarjetas.", en: "Carry soles in cash for markets and tips; restaurants accept cards." }
    ]
  };
})();
