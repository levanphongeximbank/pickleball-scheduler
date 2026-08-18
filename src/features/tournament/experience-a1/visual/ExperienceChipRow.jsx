import { Chip, Stack } from "@mui/material";

export default function ExperienceChipRow({ items, value, onChange }) {
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
      {items.map((item) => {
        const id = item.id || item;
        const label = item.label || item;
        const selected = value === id;
        return (
          <Chip
            key={id}
            label={label}
            size="small"
            clickable
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            onClick={() => onChange(id)}
          />
        );
      })}
    </Stack>
  );
}
