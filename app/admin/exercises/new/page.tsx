import { ExerciseEditor } from "@/components/admin/exercise-editor";
export default function NewExercisePage() {
  return (
    <div>
      <p className="text-sm text-accent">Catálogo</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">Novo exercício</h1>
      <ExerciseEditor />
    </div>
  );
}
