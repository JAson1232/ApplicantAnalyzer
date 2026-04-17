import { useRef, useState } from 'react';

export default function FileUploadZone({ label, file, onChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      onChange(droppedFile);
    }
  };

  return (
    <div>
      <p className="mb-2 text-sm text-slate-300">{label}</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${
          dragging ? 'border-gold-400 bg-gold-500/10' : 'border-slate-600 hover:border-gold-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
        <p className="text-sm text-slate-200">Drop PDF here or click to upload</p>
        <p className="mt-2 text-xs text-slate-400">{file ? file.name : 'No file selected'}</p>
      </div>
    </div>
  );
}
