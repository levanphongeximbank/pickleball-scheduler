const sampleCourts = Array.from({ length: 8 }, (_, index) => {
  const number = index + 1;
  return {
    id: number,
    name: `Sân ${number}`,
    number,
    active: true,
  };
});

export default sampleCourts;
