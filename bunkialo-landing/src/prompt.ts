// The agent prompt box: types a request, runs the CLI calls, then shows the answer.
import { gsap } from "gsap";

type Example = { ask: string; tools: string[]; answer: string };

const examples: Example[] = [
  {
    ask: "Check my attendance and find me the best way to compensate with duty leaves based on nearby events",
    tools: ["bunkialo attendance summary", "bunkialo attendance sessions IHS311"],
    answer: "HRM is your only course under 80%, at 8 of 11. Attend the next three classes and claim duty leave for the hackathon on 24 October, which clashes with the fourth. That brings you to 12 of 15: exactly 80%.",
  },
  {
    ask: "Tell me all the assignments that are yet to be done",
    tools: ["bunkialo lms assignments"],
    answer: "Two are still open: the AI project report and slides, due Sunday 18 October at 23:59, and PDC lab 6, due Wednesday 21 October. Everything else is submitted.",
  },
  {
    ask: "Do I have any quiz nearby?",
    tools: ["bunkialo lms recent"],
    answer: "One: AI Quiz 2 opens Tuesday 20 October at 10:30 and closes at 11:15. Quiz 1 is already finished.",
  },
];

export function mountPrompt(box: HTMLElement, calm: boolean): { play: () => void; pause: () => void } {
  const text = box.querySelector("[data-prompt-text]");
  const tools = box.querySelector("[data-prompt-tools]");
  const answer = box.querySelector<HTMLElement>("[data-prompt-answer]");
  const picks = [...box.querySelectorAll<HTMLButtonElement>("[data-pick]")];
  let index = 0;
  let timeline: gsap.core.Timeline | undefined;
  let advance: gsap.core.Tween | undefined;
  let live = false;

  const show = (next: number, animate: boolean) => {
    index = next;
    const example = examples[index];
    for (const pick of picks) pick.setAttribute("aria-pressed", String(Number(pick.dataset.pick) === index));
    if (!text || !tools || !answer) return;
    tools.replaceChildren(
      ...example.tools.map((tool) => {
        const item = document.createElement("li");
        item.textContent = tool;
        return item;
      }),
    );
    answer.textContent = example.answer;
    timeline?.kill();
    advance?.kill();
    if (!animate) {
      text.textContent = example.ask;
      box.classList.remove("is-typing");
      return;
    }
    const typed = { n: 0 };
    const items = [...tools.children];
    timeline = gsap.timeline({
      onComplete: () => {
        if (live) advance = gsap.delayedCall(5, () => live && show((index + 1) % examples.length, true));
      },
    });
    timeline
      .call(() => box.classList.add("is-typing"))
      .set(items, { opacity: 0, x: -8 })
      .set(answer, { opacity: 0, y: 8 })
      .to(typed, { n: example.ask.length, duration: example.ask.length * 0.028, ease: "none", onUpdate: () => void (text.textContent = example.ask.slice(0, Math.round(typed.n))) })
      .call(() => box.classList.remove("is-typing"))
      .to(items, { opacity: 1, x: 0, duration: 0.35, stagger: 0.5, ease: "power2.out" }, ">+0.3")
      .to(answer, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ">+0.5");
  };

  box.addEventListener("click", (event) => {
    const pick = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-pick]") : null;
    if (!pick) return;
    show(Number(pick.dataset.pick), !calm);
  });

  return {
    play: () => {
      if (live || calm) return;
      live = true;
      show(index, true);
    },
    pause: () => {
      live = false;
      advance?.kill();
    },
  };
}
