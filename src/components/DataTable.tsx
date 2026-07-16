interface Column<T> {
  key: keyof T;
  title: string;
}

interface Props<T extends { id: number }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
}

export default function DataTable<T extends { id: number }>({ columns, rows, loading }: Props<T>) {
  if (loading) return <div className="rounded bg-white p-4">Loading...</div>;
  if (!rows.length) return <div className="rounded bg-white p-4">No records found.</div>;
  return (
    <table className="w-full rounded bg-white text-left">
      <thead className="border-b">
        <tr>
          {columns.map((column) => (
            <th className="px-4 py-3" key={String(column.key)}>
              {column.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className="border-b" key={row.id}>
            {columns.map((column) => (
              <td className="px-4 py-3" key={String(column.key)}>
                {String(row[column.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
