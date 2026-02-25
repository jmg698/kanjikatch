import { CaptureInput } from "./capture-input";

export default function CapturePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
        <p className="text-muted-foreground mt-1">
          Add Japanese learning materials from an image or text.
        </p>
      </div>

      <CaptureInput />
    </div>
  );
}
