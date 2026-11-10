// District-level units people still use to name where a way of speaking comes from.
// Names follow the pre-2025 administrative map (before districts were abolished and
// Quảng Nam merged into Đà Nẵng), because that is how speakers identify places.
export const DISTRICT_GROUPS = [
  {
    label: "Đà Nẵng",
    items: ["Quận Cẩm Lệ", "Quận Hải Châu", "Quận Liên Chiểu", "Quận Ngũ Hành Sơn", "Quận Sơn Trà", "Quận Thanh Khê", "Huyện Hòa Vang"],
  },
  {
    label: "Quảng Nam",
    items: [
      "TP. Tam Kỳ", "TP. Hội An", "TX. Điện Bàn", "Huyện Duy Xuyên", "Huyện Đại Lộc", "Huyện Thăng Bình",
      "Huyện Quế Sơn", "Huyện Nông Sơn", "Huyện Hiệp Đức", "Huyện Tiên Phước", "Huyện Phú Ninh", "Huyện Núi Thành",
      "Huyện Bắc Trà My", "Huyện Nam Trà My", "Huyện Phước Sơn", "Huyện Nam Giang", "Huyện Đông Giang", "Huyện Tây Giang",
    ],
  },
] as const;

export const DISTRICTS: string[] = DISTRICT_GROUPS.flatMap((g) => [...g.items]);

/** For people who do not know, or move between places. Not a review region. */
export const UNSURE_REGION = "Không chắc";

/** Choices a contributor may give for where they live / grew up / heard a phrase. */
export const REGION_CHOICES: string[] = [...DISTRICTS, UNSURE_REGION];
