import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExercisePreviewVideo } from "./viewport-video";
describe("ExercisePreviewVideo", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
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
  it("shows the poster before an animated GIF when reduced motion is enabled", () => {
    const { getByRole, getByTestId } = render(
      <ExercisePreviewVideo
        mediaType="gif"
        src="https://example.test/demo.gif"
        poster="https://example.test/poster.webp"
      />,
    );
    expect(getByTestId("exercise-preview-poster")).toHaveAttribute(
      "src",
      expect.stringContaining("poster.webp"),
    );
    fireEvent.click(getByRole("button", { name: "Ver execução animada" }));
    expect(getByTestId("exercise-preview-gif")).toHaveAttribute(
      "src",
      expect.stringContaining("demo.gif"),
    );
  });
});
