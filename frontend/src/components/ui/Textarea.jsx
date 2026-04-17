export default function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-gold-500 ${
        props.className || ''
      }`}
    />
  );
}
