export default function LodgingPage() {
  const hotels = [
    {
      name: "Hilton Nashville Green Hills",
      distance: "About 10 minutes from the venue",
      description:
        "Full-service hotel with a restaurant, pool, and fitness center. Great option if you want something upscale and close.",
      area: "Green Hills",
    },
    {
      name: "Residence Inn by Marriott Nashville Green Hills",
      distance: "About 10 minutes from the venue",
      description:
        "All-suite hotel with full kitchens, free breakfast, and an outdoor pool. Perfect for families or longer stays.",
      area: "Green Hills",
    },
    {
      name: "Hampton Inn & Suites Nashville Green Hills",
      distance: "About 10 minutes from the venue",
      description:
        "Reliable pick with free breakfast, a seasonal pool, and free parking. Solid and easy.",
      area: "Green Hills",
    },
    {
      name: "Hyatt Place Nashville Green Hills",
      distance: "About 10 minutes from the venue",
      description:
        "Modern rooms, a fitness center, and a lounge area. Close to great shopping and restaurants in the Green Hills area.",
      area: "Green Hills",
    },
    {
      name: "Best Western Plus Belle Meade Inn & Suites",
      distance: "About 5 minutes from the venue",
      description:
        "The closest hotel to Belle Meade. Includes breakfast, free parking, and an outdoor pool. No frills, but you can't beat the location.",
      area: "Belle Meade",
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
              rideshare (Uber and Lyft both work well here). If you&apos;re staying
              in Green Hills or Belle Meade, most things are a short drive away.
            </p>
          </div>
        </div>
      </section>

      {/* Where to Stay */}
      <section className="mb-12">
        <h2 className="text-2xl font-heading text-deep-sage mb-2">
          Where to Stay
        </h2>
        <p className="text-sm text-dark/60 mb-6">
          We don&apos;t have an official hotel block, but here are some great
          options close to the venue. The Green Hills area is about 10 minutes
          from Belle Meade and has plenty of restaurants and shops nearby.
        </p>
        <div className="space-y-4">
          {hotels.map((hotel) => (
            <div
              key={hotel.name}
              className="rounded-xl border border-sage/30 bg-white p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-dark">{hotel.name}</h3>
                  <p className="text-xs text-dark/50 mt-0.5">
                    {hotel.area} &middot; {hotel.distance}
                  </p>
                </div>
              </div>
              <p className="text-sm text-dark/70 mt-2">{hotel.description}</p>
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
            A historic plantation estate in the heart of Nashville&apos;s Belle
            Meade neighborhood. The ceremony and reception will both take place
            here. Parking is available on site.
          </p>
        </div>
      </section>
    </div>
  );
}
