import UploadForm from '@/components/UploadForm';

export const metadata = {
  title: 'Upload 3D Model | PrintPro3D',
};

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Upload Your 3D Model
          </h1>
          <p className="mt-3 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Drag and drop your file below to upload and preview your model in 3D before ordering.
          </p>
        </div>

        {/* Upload Component */}
        <UploadForm />

        {/* Supported Formats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'STL Files',
              desc: 'Standard Triangle Language format, widely used for 3D printing.',
              format: '.stl',
            },
            {
              title: 'OBJ Files',
              desc: 'Wavefront OBJ format with support for color and texture data.',
              format: '.obj',
            },
            {
              title: 'GLB / GLTF',
              desc: 'Modern glTF format with embedded textures and PBR materials.',
              format: '.glb, .gltf',
            },
          ].map((fmt) => (
            <div
              key={fmt.format}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{fmt.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{fmt.desc}</p>
              <span className="mt-3 inline-block px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-600 dark:text-gray-400">
                {fmt.format}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
