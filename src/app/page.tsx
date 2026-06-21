import CourseWorkspace from "@/components/CourseWorkspace";
import { Suspense } from "react";
import WorkspaceSkeleton from "@/components/WorkspaceSkeleton";

type HomeProps = {
  searchParams: Promise<{ course?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { course } = await searchParams;
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <CourseWorkspace initialCourseId={course} />
    </Suspense>
  );
}
