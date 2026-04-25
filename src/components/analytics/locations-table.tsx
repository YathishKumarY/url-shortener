import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  data: { country: string; clicks: number }[];
}

export function LocationsTable({ data }: Props) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h3 className="text-foreground mb-4 text-sm font-semibold">Top Locations</h3>
      {data.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No location data yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Country</TableHead>
              <TableHead className="text-muted-foreground text-right">Clicks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.country} className="border-border">
                <TableCell className="text-sm">{row.country || "Unknown"}</TableCell>
                <TableCell className="text-right text-sm">{row.clicks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
