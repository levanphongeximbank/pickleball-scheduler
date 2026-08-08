import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

import { buildActionQueue } from "../../features/action-queue/services/actionQueueService.js";

export default function CourtOpsLogPage() {
  const { clubId } = useOutletContext();
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queue = await buildActionQueue({ clubId });
      if (cancelled) return;
      setEntries(
        queue.map((item) => ({
          id: item.id,
          action: item.title,
          detail: item.subtitle,
          at: item.createdAt,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return (
    <>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
        Nhật ký vận hành
      </Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Thời gian</TableCell>
              <TableCell>Sự kiện</TableCell>
              <TableCell>Chi tiết</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">Chưa có sự kiện vận hành ghi nhận.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.at}</TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.detail}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
}
