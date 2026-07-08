export function DataTable({
  headers,
  rows,
  empty = "데이터가 없습니다.",
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) return <div className="empty-state">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
