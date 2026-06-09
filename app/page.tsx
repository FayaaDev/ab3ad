import { UploadForm } from '@/components/upload-form';

export default function HomePage() {
  return (
    <section className="page stack-xl">
      <div className="hero stack">
        <p className="eyebrow">MVP</p>
        <h1>Generate textured 3D models from image uploads.</h1>
        <p>
          This starter implements the upload, job queue, status tracking, callback endpoint, retry flow, and permanent result storage described in plan.md.
        </p>
      </div>
      <UploadForm />
    </section>
  );
}
