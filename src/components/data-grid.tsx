"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { useTheme } from "next-themes";
import { glossaryEntry, termLabel } from "@/lib/glossary";

ModuleRegistry.registerModules([AllCommunityModule]);

type Props<T> = {
  rows: T[];
  columns: ColDef<T>[];
  height?: number;
  empty?: string;
  pagination?: boolean;
  pageSize?: number;
  getRowId?: (row: T) => string;
  onRowClicked?: (row: T) => void;
};

export function DataGrid<T>({
  rows,
  columns,
  height = 520,
  empty = "No rows yet.",
  pagination = true,
  pageSize = 50,
  getRowId,
  onRowClicked,
}: Props<T>) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const theme = useMemo(
    () =>
      themeQuartz.withParams(
        dark
          ? {
              backgroundColor: "#000000",
              foregroundColor: "#f5f5f5",
              headerBackgroundColor: "#0a0a0a",
              oddRowBackgroundColor: "#0a0a0a",
              borderColor: "#262626",
              accentColor: "#d4a24c",
              fontSize: 13,
            }
          : {
              backgroundColor: "#fffdf8",
              foregroundColor: "#1a1814",
              headerBackgroundColor: "#ebe6db",
              oddRowBackgroundColor: "#fffdf8",
              borderColor: "#d8d0c0",
              accentColor: "#9a6b16",
              fontSize: 13,
            },
      ),
    [dark],
  );
  const colDefs = useMemo(
    () =>
      columns.map((c) => {
        const field = typeof c.field === "string" ? c.field : undefined;
        const entry = field ? glossaryEntry(field) : undefined;
        return {
          ...c,
          headerName: c.headerName ?? (field ? termLabel(field, field) : c.headerName),
          headerTooltip: c.headerTooltip ?? entry?.hint,
        };
      }),
    [columns],
  );

  if (!rows.length) {
    return <p className="px-3 py-8 text-center text-sm text-mute">{empty}</p>;
  }

  return (
    <div style={{ height }} className="data-grid w-full overflow-hidden rounded-lg border border-line">
      <AgGridReact<T>
        theme={theme}
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 96, cellDataType: false }}
        rowHeight={36}
        headerHeight={36}
        animateRows
        suppressCellFocus
        tooltipShowDelay={200}
        pagination={pagination}
        paginationPageSize={pageSize}
        paginationPageSizeSelector={[25, 50, 100, 200]}
        getRowId={getRowId ? (p) => getRowId(p.data as T) : undefined}
        onRowClicked={onRowClicked ? (e) => e.data && onRowClicked(e.data) : undefined}
      />
    </div>
  );
}
