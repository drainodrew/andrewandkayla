export default function LodgingPage() {
  const sections = [
    {
      title: "Big Baller Alert",
      description: "You want the best? Say less.",
      hotels: [
        {
          name: "The Hermitage Hotel",
          proximity: "~15 min from venue",
          description:
            "Nashville's only five-star hotel and a National Historic Landmark. Over 110 years of history, a recent renovation, and the kind of lobby that makes you stand up straighter. Downtown.",
        },
        {
          name: "JW Marriott Nashville",
          proximity: "~15 min from venue",
          description:
            "34 floors of luxury right on Broadway. Rooftop pool, full spa, and views of the whole city. If you're going to splurge, this is a great place to do it.",
        },
        {
          name: "The Joseph, a Luxury Collection Hotel",
          proximity: "~15 min from venue",
          description:
            "Art-forward luxury hotel in the SoBro neighborhood. Beautiful design, world-class dining, and a rooftop bar. Nashville's newest high-end option.",
        },
      ],
    },
    {
      title: '"No, But Like Artistic"',
      description: "Boutique hotels with personality.",
      hotels: [
        {
          name: "Noelle Nashville",
          proximity: "~15 min from venue",
          description:
            "A 224-room boutique hotel in a restored 1930s building downtown. Art-driven, creative, and very Nashville. The lobby bar is worth a visit on its own.",
        },
        {
          name: "Urban Cowboy Nashville",
          proximity: "~20 min from venue",
          description:
            "East Nashville charm in a Victorian mansion turned boutique hotel. Eclectic rooms, a great patio, and the kind of place that feels like a friend's very cool house.",
        },
        {
          name: "The Fairlane Hotel",
          proximity: "~15 min from venue",
          description:
            "Retro-chic boutique hotel steps from Broadway. Mid-century modern vibes, a killer rooftop, and a Cond\u00e9 Nast Traveler nominee. Style for days.",
        },
      ],
    },
    {
      title: '"Buena, Bonita, Barata"',
      description: "Great stays that won't break the bank.",
      hotels: [
        {
          name: "Best Western Plus Belle Meade Inn & Suites",
          proximity: "~5 min from venue",
          description:
            "The closest hotel to Belle Meade. Includes breakfast, free parking, and an outdoor pool. No frills, but you literally cannot beat the location.",
        },
        {
          name: "Hampton Inn & Suites Nashville Green Hills",
          proximity: "~10 min from venue",
          description:
            "Free breakfast, seasonal pool, free parking. Reliable and easy. Close to great shopping and food in the Green Hills area.",
        },
        {
          name: "Hyatt Place Nashville Green Hills",
          proximity: "~10 min from venue",
          description:
            "Modern rooms, fitness center, and a lounge. Green Hills has plenty of restaurants within walking distance.",
        },
      ],
    },
    {
      title: '"Big Squad?"',
      description: "If you're rolling deep, grab a house.",
      hotels: [
        {
          name: "Airbnb",
          proximity: "Varies",
          description:
            "Nashville has tons of great Airbnbs, especially in the Belle Meade, Sylvan Park, and 12 South neighborhoods. Great option for families or groups who want to stay together. Search for places near 37205 or 37209 to be close to the venue.",
        },
      ],
    },
    {
      title: '"No Room in the Inn?"',
      description: "I can probably find you a couch to sleep on.",
      hotels: [],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        Lodging & Travel
      </h1>
      <p className="text-center text-dark/60 mb-12">
        Everything you need to plan your trip to Nashville.
      </p>

      {/* Getting There */}
      <section className="mb-12">
        <h2 className="text-2xl font-heading text-deep-sage mb-4">
          Getting There
        </h2>
        <div className="rounded-xl border border-sage/30 bg-white p-6 space-y-4">
          <div>
            <h3 className="font-medium text-dark mb-1">By Air</h3>
            <p className="text-sm text-dark/70">
              Fly into Nashville International Airport (BNA). It&apos;s about 20
              minutes from the venue, depending on traffic. Rideshare and rental
              cars are both easy from BNA.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-dark mb-1">By Car</h3>
            <p className="text-sm text-dark/70">
              Belle Meade Mansion is located at 110 Leake Ave, Nashville, TN
              37205. There is parking available at the venue.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-dark mb-1">Getting Around</h3>
            <p className="text-sm text-dark/70">
              Nashville is a car city. We recommend renting a car or using
              rideshare (Uber and Lyft both work well here). If you&apos;re
              staying in Green Hills or Belle Meade, most things are a short
              drive away.
            </p>
          </div>
        </div>
      </section>

      {/* Where to Stay */}
      <section className="mb-12">
        <h2 className="text-2xl font-heading text-deep-sage mb-2">
          Where to Stay
        </h2>
        <p className="text-sm text-dark/60 mb-8">
          We don&apos;t have an official hotel block, but we&apos;ve got options
          for every vibe and budget.
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xl font-heading text-deep-sage mb-1">
                {section.title}
              </h3>
              <p className="text-sm text-dark/50 mb-4">
                {section.description}
              </p>
              {section.hotels.length > 0 ? (
                <div className="space-y-3">
                  {section.hotels.map((hotel) => (
                    <div
                      key={hotel.name}
                      className="rounded-xl border border-sage/30 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="font-medium text-dark">{hotel.name}</h4>
                        <span className="shrink-0 text-xs text-dark/50">
                          {hotel.proximity}
                        </span>
                      </div>
                      <p className="text-sm text-dark/70 mt-1.5">
                        {hotel.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-sage/30 bg-white p-5">
                  <p className="text-sm text-dark/70 italic">
                    Seriously though, reach out. We&apos;ll figure something out.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Venue */}
      <section>
        <h2 className="text-2xl font-heading text-deep-sage mb-4">
          The Venue
        </h2>
        <div className="rounded-xl border border-sage/30 bg-white p-6">
          <h3 className="font-medium text-dark mb-1">Belle Meade Mansion</h3>
          <p className="text-sm text-dark/70 mb-3">
            110 Leake Ave, Nashville, TN 37205
          </p>
          <p className="text-sm text-dark/70">
            A historic estate in the heart of Nashville&apos;s Belle Meade
            neighborhood. The ceremony and reception will both take place here.
            Parking is available on site.
          </p>
        </div>
      </section>
    </div>
  );
}
