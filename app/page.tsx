import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Hero */}
      <section className="text-center mb-20">
        <h1 className="text-6xl sm:text-7xl font-heading text-deep-sage mb-4">
          Andrew & Kayla
        </h1>
        <p className="text-xl text-dark/80 mb-2">
          Saturday, August 29, 2026
        </p>
        <p className="text-dark/60 mb-8">
          Belle Meade Mansion &middot; Nashville, Tennessee
        </p>
        <p className="text-lg text-dark/70 max-w-xl mx-auto leading-relaxed">
          A celebration of love, family, and the people who made us who we are.
          We can&apos;t wait to share this day with you.
        </p>
        <div className="mt-8">
          <Link
            href="/rsvp"
            className="inline-block rounded-lg bg-pink px-8 py-3 font-medium text-dark transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
          >
            RSVP
          </Link>
        </div>
      </section>

      {/* Photo placeholder */}
      <section className="mb-20">
        <div className="aspect-[16/9] rounded-2xl bg-sage/10 border-2 border-dashed border-sage/30 flex items-center justify-center">
          <p className="text-dark/30 text-sm">Photo coming soon</p>
        </div>
      </section>

      {/* Our Story */}
      <section className="mb-20">
        <h2 className="text-3xl font-heading text-deep-sage mb-6 text-center">
          Our Story
        </h2>
        <div className="max-w-2xl mx-auto space-y-5 text-dark/80 leading-relaxed">
          <p>
            Andrew had been hearing Kayla&apos;s name for years. She was
            Kara&apos;s little sister. She was the one who demolished all of his
            Cutco sales records. But they didn&apos;t actually meet until they
            both moved back to Nashville in 2023.
          </p>
          <p>
            Their first date was spent honky tonking to the Cowpokes (the very
            same band that will be playing at the wedding). Andrew felt certain
            about Kayla from the start and hasn&apos;t had a wavering thought
            since.
          </p>
        </div>
      </section>

      {/* Photo placeholder */}
      <section className="mb-20">
        <div className="grid grid-cols-2 gap-4">
          <div className="aspect-[4/5] rounded-2xl bg-sage/10 border-2 border-dashed border-sage/30 flex items-center justify-center">
            <p className="text-dark/30 text-sm">Photo</p>
          </div>
          <div className="aspect-[4/5] rounded-2xl bg-sage/10 border-2 border-dashed border-sage/30 flex items-center justify-center">
            <p className="text-dark/30 text-sm">Photo</p>
          </div>
        </div>
      </section>

      {/* The Proposal */}
      <section className="mb-20">
        <h2 className="text-3xl font-heading text-deep-sage mb-6 text-center">
          The Proposal
        </h2>
        <div className="max-w-2xl mx-auto space-y-5 text-dark/80 leading-relaxed">
          <p>
            Kayla was supposed to fly home from Paris on a Sunday. Andrew
            received her family&apos;s blessing the Monday before and was so
            excited that he physically could not wait to propose.
          </p>
          <p>
            So he booked a flight the night before and surprised her on Saturday.
            She had no idea he wasn&apos;t in Nashville until she saw him
            standing there in the garden. (Shoutout to Ally for hacking his Find
            My location to make it look like he was at home.)
          </p>
          <p>
            He also flew Kara into Paris from Valencia as a surprise. She took
            the beautiful photos they&apos;ll cherish forever, and it was so
            sweet to have her be a part of that day.
          </p>
          <p>
            They canceled Kayla&apos;s return flight and bopped around Paris and
            Florence for a week.
          </p>
        </div>
      </section>

      {/* Photo placeholder */}
      <section className="mb-20">
        <div className="aspect-[16/9] rounded-2xl bg-sage/10 border-2 border-dashed border-sage/30 flex items-center justify-center">
          <p className="text-dark/30 text-sm">Proposal photos coming soon</p>
        </div>
      </section>

      {/* What This Day Is About */}
      <section className="mb-20">
        <div className="rounded-2xl border border-pink/30 bg-pink/5 p-8 sm:p-12 text-center">
          <h2 className="text-3xl font-heading text-deep-sage mb-6">
            What This Day Is About
          </h2>
          <div className="max-w-xl mx-auto space-y-4 text-dark/80 leading-relaxed">
            <p>
              For us, this day is not only about our love for each other. It is
              the union of our families, both blood and chosen.
            </p>
            <p>
              We want to celebrate with full families, with the kids, with
              everyone who has shaped who we are. We hope to give you a day full
              of love, joy, and maybe a few tears (the good kind).
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="text-center">
        <h2 className="text-2xl font-heading text-deep-sage mb-8">
          While You&apos;re Here
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Schedule", href: "/schedule" },
            { label: "Lodging", href: "/lodging" },
            { label: "Things To Do", href: "/things-to-do" },
            { label: "FAQ", href: "/faq" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-sage/30 bg-white p-4 text-sm font-medium text-dark transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
