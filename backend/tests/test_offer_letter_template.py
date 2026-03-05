import unittest
from types import SimpleNamespace

from api.v1.endpoints.deals import _parse_product_lines_from_notes, _render_offer_letter_html


class OfferLetterTemplateTests(unittest.TestCase):
    def test_parse_product_lines_from_notes(self):
        notes = "\n".join([
            "Sale Type: Local",
            "Offer No: 0061/25-26",
            "Product Lines:",
            "1. Black Bar | ROUND | 304L | 40mm,50mm | L:4-6 Meter | HT:Solutions Annealed | Tol:As Per Standard | Qty:Per Size 3 Ton | Price:185 INR/kg",
            "2. Black Bar | ROUND | 316L | 40mm,50mm | L:4-6 Meter | HT:Solutions Annealed | Tol:As Per Standard | Qty:Per Size 3 Ton | Price:310 INR/kg",
        ])
        rows = _parse_product_lines_from_notes(notes)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["grade"], "304L")
        self.assertEqual(rows[0]["product"], "Black Bar")
        self.assertEqual(rows[1]["rate"], "310 INR/kg")

    def test_render_offer_letter_contains_key_sections(self):
        deal = SimpleNamespace(
            ID=11,
            Division="TPT",
            ServiceType="Local RFQ",
            DealValue=0,
            Notes="\n".join([
                "Sale Type: Local",
                "Offer No: 0061/25-26",
                "Product Lines:",
                "1. Black Bar | ROUND | 304L | 40mm,50mm | L:4-6 Meter | HT:Solutions Annealed | Tol:As Per Standard | Qty:Per Size 3 Ton | Price:185 INR/kg",
                "Commercial: Payment Terms=20% advance balance against PI, Packing=-, Delivery=75 to 80 Days",
            ]),
            account=SimpleNamespace(Name="ALPHA LEVEL PVT LTD"),
            contact=SimpleNamespace(Name="Purchase Team"),
            salesperson=SimpleNamespace(Name="Renu Lobo"),
        )

        html_output = _render_offer_letter_html(deal)
        self.assertIn("ALPHA LEVEL PVT LTD", html_output)
        self.assertIn("0061/25-26", html_output)
        self.assertIn("Payment Terms", html_output)
        self.assertIn("data:image", html_output)


if __name__ == "__main__":
    unittest.main()

