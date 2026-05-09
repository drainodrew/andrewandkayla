export default function ThingsToDoPage() {
  const categories = [
    {
      title: "Our Favorites",
      description: "Places we love and think you will too.",
      spots: [
        {
          name: "Radnor Lake State Park",
          type: "Nature / Hiking",
          proximity: "~20 min from venue",
          description:
            "One of the best things about Nashville. A 1,368-acre natural area with beautiful trails, wildlife, and views of the lake. Easy to moderate hikes. Go early for the best parking.",
          tip: "The Lake Trail is an easy flat walk. Ganier Ridge is more of a workout with great views.",
        },
        {
          name: "Roberts Western World",
          type: "Live Music / Honky Tonk",
          proximity: "~15 min from venue",
          description:
            "The best honky tonk on Broadway, and we will not be taking questions. Great live music, cold beer, and the Recession Special (fried bologna sandwich, chips, a PBR, and a Moon Pie) is a Nashville institution.",
          tip: "Go during the day to avoid the big crowds. The music is just as good.",
        },
        {
          name: "Imogene + Willie",
          type: "Shopping",
          proximity: "~15 min from venue",
          description:
            "A Nashville-born denim and clothing shop in a converted gas station in 12 South. Beautiful quality, great vibes. Worth a visit even if you're just browsing.",
          tip: "While you're in 12 South, walk the neighborhood. Lots of good coffee and food nearby.",
        },
      ],
    },
    {
      title: "Where to Eat",
      description: "A few of our go-to spots around town.",
      spots: [
        {
          name: "Sushi Bar",
          type: "High-End Sushi",
          proximity: "~15 min from venue",
          description:
            "Unreal. If you're looking for a special meal on Friday night or Sunday before you head home, this is it. Omakase-style, intimate, and worth every penny. Reservations required.",
          tip: "Book well in advance. This place fills up fast.",
        },
        {
          name: "Mas Tacos Por Favor",
          type: "Casual / Tacos",
          proximity: "~20 min from venue",
          description:
            "A tiny spot in East Nashville with some of the best tacos in the city. Cash only, no frills, and always worth the trip. The elote and fried avocado tacos are legendary.",
          tip: "Go for lunch. The line moves fast.",
        },
        {
          name: "Sperry's",
          type: "Steakhouse",
          proximity: "~5 min from venue",
          description:
            "A classic Nashville steakhouse in Belle Meade. Old school, great steaks, strong drinks. It's right near the venue if you want a nice dinner while you're in the neighborhood.",
          tip: null,
        },
        {
          name: "Baja Burrito",
          type: "Casual / Lunch",
          proximity: "~10 min from venue",
          description:
            "Our go-to for a quick, easy lunch. Fresh burritos, tacos, and bowls. Nothing fancy, just really solid food at a great price.",
          tip: null,
        },
        {
          name: "Stay Golden",
          type: "Breakfast / Brunch / Coffee",
          proximity: "~10 min from venue",
          description:
            "My brother-in-law's restaurant and coffee shop in The Nations. Locally roasted coffee beans, the best biscuits in Nashville, and a great breakfast or brunch spot. This one is family, and the food speaks for itself.",
          tip: null,
        },
        {
          name: "Prince's Hot Chicken",
          type: "Hot Chicken",
          proximity: "~20 min from venue",
          description:
            "The original Nashville hot chicken. Prince's has been around since the 1940s and it's still the real deal. Order mild if you're not sure, medium if you're brave, and hot if you have something to prove.",
          tip: "There are a few locations now. The Nolensville Pike location is the classic.",
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        Things To Do
      </h1>
      <p className="text-center text-dark/60 mb-12">
        Nashville is an incredible city. Here are some of our favorite spots to
        check out while you&apos;re here.
      </p>

      <div className="space-y-12">
        {categories.map((category) => (
          <section key={category.title}>
            <h2 className="text-2xl font-heading text-deep-sage mb-1">
              {category.title}
            </h2>
            <p className="text-sm text-dark/60 mb-6">{category.description}</p>
            <div className="space-y-4">
              {category.spots.map((spot) => (
                <div
                  key={spot.name}
                  className="rounded-xl border border-sage/30 bg-white p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-dark">{spot.name}</h3>
                      <span className="shrink-0 rounded-full bg-sage/20 px-3 py-0.5 text-xs font-medium text-deep-sage">
                        {spot.type}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-dark/50">
                      {spot.proximity}
                    </span>
                  </div>
                  <p className="text-sm text-dark/70">{spot.description}</p>
                  {spot.tip && (
                    <p className="text-sm text-dark/50 mt-2 italic">
                      {spot.tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-pink/30 bg-pink/5 p-6 text-center">
        <p className="text-sm text-dark/70">
          Want more recommendations? Ask Andrew or Kayla. We&apos;re always
          happy to help you plan your Nashville trip.
        </p>
      </div>
    </div>
  );
}
