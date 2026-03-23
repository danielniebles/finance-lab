import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/format";

type Props = {
  month: number;
  year: number;
};

export async function AnalysisDashboard({ month, year }: Props) {
  const data = await getMonthlyAnalysis(month, year);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Income" value={data.totalIncome} positive />
        <SummaryCard label="Total Expenses" value={data.totalExpenses} />
        <SummaryCard
          label="Expected Savings"
          value={data.expectedSavings}
          positive={data.expectedSavings >= 0}
        />
        <SummaryCard
          label="Actual Savings"
          value={data.actualSavings}
          positive={data.actualSavings >= 0}
          highlight={data.actualSavings < data.expectedSavings ? "warn" : undefined}
        />
      </div>

      {/* Unmapped warning */}
      {data.uncategorizedCount > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {data.uncategorizedCount} transaction(s) have unmapped categories and are excluded from the analysis.{" "}
          <a href="/settings/mappings" className="underline">
            Configure mappings →
          </a>
        </div>
      )}

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categoryBreakdown.map((row: { id: string; name: string; budgetType: string; budget: number; spent: number; remaining: number; overBudget: boolean }) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.budgetType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCOP(row.budget)}</TableCell>
                  <TableCell className="text-right">{formatCOP(row.spent)}</TableCell>
                  <TableCell className="text-right">
                    <span className={row.remaining < 0 ? "text-destructive" : ""}>
                      {formatCOP(row.remaining)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.overBudget ? (
                      <Badge variant="destructive">Over budget</Badge>
                    ) : row.spent === 0 ? (
                      <Badge variant="secondary">No spend</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  positive,
  highlight,
}: {
  label: string;
  value: number;
  positive?: boolean;
  highlight?: "warn";
}) {
  return (
    <Card className={highlight === "warn" ? "border-yellow-300" : ""}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <span
          className={`text-lg font-semibold ${
            positive === false ? "text-destructive" : positive ? "text-green-700" : ""
          }`}
        >
          {formatCOP(value)}
        </span>
      </CardContent>
    </Card>
  );
}
