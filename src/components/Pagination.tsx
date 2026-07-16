interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);

  return (
    <div className="mt-4 flex items-center justify-between">
      <button
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pages.slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5).map((pageNo) => (
          <button
            key={pageNo}
            className={`h-8 min-w-8 rounded-md px-2 text-sm ${
              pageNo === page ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"
            }`}
            onClick={() => onPageChange(pageNo)}
          >
            {pageNo}
          </button>
        ))}
      </div>
      <button
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
