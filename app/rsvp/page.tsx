import { RsvpFlow } from "@/components/rsvp/rsvp-flow";

export default function RSVPPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        RSVP
      </h1>
      <p className="text-center text-dark/60 mb-10">
        Search for your name to let us know if you can make it.
      </p>
      <RsvpFlow />
    </div>
  );
}
