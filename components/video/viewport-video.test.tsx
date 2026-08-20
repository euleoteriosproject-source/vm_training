import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExercisePreviewVideo } from "./viewport-video";
describe("ExercisePreviewVideo", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi
        .fn()
        .mockImplementation(() => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });
  it("does not autoplay with reduced motion and stays inline", () => {
    const { container } = render(
      <ExercisePreviewVideo
        src="https://example.test/video.mp4"
        poster="poster.webp"
      />,
    );
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("playsinline");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(
      container.querySelector('button[aria-label="Reproduzir demonstração"]'),
    ).toBeInTheDocument();
  });
  it("uses a neutral review state instead of generic animation", () => {
    const { getByText } = render(<ExercisePreviewVideo />);
    expect(getByText("Demonstração em revisão")).toBeVisible();
  });
});
