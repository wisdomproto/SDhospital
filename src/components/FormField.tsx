export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded border px-3 py-2 text-sm";
