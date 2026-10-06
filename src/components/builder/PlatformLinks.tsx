import Image from "next/image";

const platforms = [
  {
    name: "ChatGPT",
    provider: "OpenAI",
    image: "openai",
    url: "https://chatgpt.com/",
  },
  {
    name: "Claude",
    provider: "Anthropic",
    image: "anthropic",
    url: "https://claude.ai/new",
  },
  {
    name: "Gemini",
    provider: "Google",
    image: "gemini",
    url: "https://gemini.google.com/app",
  },
];

export default function PlatformLinks() {
  return (
    <section className="platform-section">
      <div className="platform-heading">
        <div>
          <div className="section-kicker">WORKS WITH YOUR FAVORITES</div>
          <h2>One prompt. Any platform.</h2>
          <p>Copy your prompt, then open the AI tool you use.</p>
        </div>
        <span className="platform-note">No account connection needed ↗</span>
      </div>
      <div className="platform-list">
        {platforms.map((item) => (
          <a
            className="platform-card"
            href={item.url}
            key={item.name}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="platform-logo"
              src={`/assets/brands/${item.image}.png`}
              width={29}
              height={29}
              alt=""
            />
            <span>
              <strong>{item.name}</strong>
              <small>{item.provider}</small>
            </span>
            <span className="platform-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
