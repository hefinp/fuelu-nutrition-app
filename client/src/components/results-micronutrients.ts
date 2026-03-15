export interface MicroItem { name: string; amount: number; unit: string; note?: string }
export interface MicroCategory { label: string; items: MicroItem[] }

export function getMicronutrients(age: number, gender: string): MicroCategory[] {
  const m = gender === 'male';
  const o = age >= 51;
  const e = age >= 71;
  return [
    {
      label: "Vitamins",
      items: [
        { name: "Vitamin A",              amount: m ? 900 : 700,                            unit: "mcg" },
        { name: "Vitamin C",              amount: m ? 90 : 75,                              unit: "mg" },
        { name: "Vitamin D",              amount: e ? 20 : 15,                              unit: "mcg" },
        { name: "Vitamin E",              amount: 15,                                        unit: "mg" },
        { name: "Vitamin K",              amount: m ? 120 : 90,                             unit: "mcg" },
        { name: "Vitamin B1 (Thiamine)",  amount: m ? 1.2 : 1.1,                           unit: "mg" },
        { name: "Vitamin B2 (Riboflavin)",amount: m ? 1.3 : 1.1,                           unit: "mg" },
        { name: "Vitamin B3 (Niacin)",    amount: m ? 16 : 14,                             unit: "mg NE" },
        { name: "Vitamin B6",             amount: m ? (o ? 1.7 : 1.3) : (o ? 1.5 : 1.3),  unit: "mg" },
        { name: "Vitamin B12",            amount: 2.4,                                       unit: "mcg" },
        { name: "Folate",                 amount: 400,                                       unit: "mcg DFE" },
        { name: "Biotin (B7)",            amount: 30,                                        unit: "mcg" },
        { name: "Pantothenic Acid (B5)",  amount: 5,                                         unit: "mg" },
      ],
    },
    {
      label: "Minerals & Fibre",
      items: [
        { name: "Calcium",    amount: (o && !m) || e ? 1200 : 1000,                unit: "mg" },
        { name: "Iron",       amount: m ? 8 : (o ? 8 : 18),                        unit: "mg" },
        { name: "Magnesium",  amount: m ? (age < 31 ? 400 : 420) : (age < 31 ? 310 : 320), unit: "mg" },
        { name: "Zinc",       amount: m ? 11 : 8,                                  unit: "mg" },
        { name: "Potassium",  amount: m ? 3400 : 2600,                             unit: "mg" },
        { name: "Phosphorus", amount: 700,                                          unit: "mg" },
        { name: "Sodium",     amount: 2300,                                         unit: "mg", note: "max" },
        { name: "Selenium",   amount: 55,                                           unit: "mcg" },
        { name: "Iodine",     amount: 150,                                          unit: "mcg" },
        { name: "Copper",     amount: 900,                                          unit: "mcg" },
        { name: "Manganese",  amount: m ? 2.3 : 1.8,                              unit: "mg" },
        { name: "Dietary Fibre", amount: m ? (o ? 30 : 38) : (o ? 21 : 25),      unit: "g" },
      ],
    },
  ];
}
