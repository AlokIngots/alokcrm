import React, { useMemo, useState } from 'react';

const PRODUCT_LINES = ['Bright Bars', 'Wire Rods', 'Ingots & Billets', 'Forged Bars', 'Flats & Profiles'];

const GRADE_FAMILIES = {
  'Stainless Steel': ['SS 202', 'SS 304', 'SS 316', 'SS 410', 'SS 420'],
  'Alloy Steel': ['EN8', 'EN19', 'EN24', '42CrMo4', '20MnCr5'],
  'Carbon Steel': ['C15', 'C20', 'C45', 'SAE 1018', 'SAE 1045'],
  'Tool Steel': ['D2', 'H13', 'OHNS', 'M2'],
};

const SHAPES = ['Round', 'Hex', 'Square', 'Flat'];
const DIA_RANGES = ['6-12 mm', '12-20 mm', '20-35 mm', '35-50 mm', '50-80 mm', '80+ mm'];
const TOLERANCES = ['h9', 'h10', '+/-0.05 mm', '+/-0.10 mm', '+/-0.20 mm'];
const HEAT_TREATMENT = ['Annealed', 'Normalized', 'QT (Quenched & Tempered)', 'Spheroidized', 'As Rolled'];
const FINISH = ['Black', 'Peeled', 'Ground', 'Polished', 'Drawn'];
const TESTING = ['UT', 'ET', 'MPI', 'Mill TC', 'In-house QC'];
const PACKAGING = ['Loose Bundle', 'Wooden Box', 'Palletized', 'Export Packing'];

const defaultForm = {
  productLine: 'Bright Bars',
  gradeFamily: 'Stainless Steel',
  grade: 'SS 304',
  shape: 'Round',
  diaRange: '12-20 mm',
  tolerance: 'h9',
  heatTreatment: 'Annealed',
  finish: 'Peeled',
  testing: 'Mill TC',
  packaging: 'Loose Bundle',
  application: '',
};

const Products = () => {
  const [form, setForm] = useState(defaultForm);
  const [products, setProducts] = useState([]);

  const gradeOptions = useMemo(() => GRADE_FAMILIES[form.gradeFamily] || [], [form.gradeFamily]);
  const skuPreview = `${form.productLine.slice(0, 2).toUpperCase()}-${form.grade.replace(/\s+/g, '')}-${form.shape.toUpperCase()}-${form.diaRange.replace(/\s+/g, '')}`;

  const handleChange = (field, value) => {
    if (field === 'gradeFamily') {
      const nextGrades = GRADE_FAMILIES[value] || [];
      setForm((prev) => ({
        ...prev,
        gradeFamily: value,
        grade: nextGrades[0] || '',
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddProduct = () => {
    setProducts((prev) => [
      {
        id: Date.now(),
        sku: skuPreview,
        ...form,
      },
      ...prev,
    ]);
    setForm((prev) => ({ ...defaultForm, productLine: prev.productLine }));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Alok Ingots product master with practical commercial and technical dropdowns.</p>
        </div>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Create Product Spec</h2>
            <p className="text-sm text-gray-500">SKU Preview: <span className="font-semibold text-gray-800">{skuPreview}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <select value={form.productLine} onChange={(e) => handleChange('productLine', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PRODUCT_LINES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.gradeFamily} onChange={(e) => handleChange('gradeFamily', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.keys(GRADE_FAMILIES).map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.grade} onChange={(e) => handleChange('grade', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {gradeOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.shape} onChange={(e) => handleChange('shape', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {SHAPES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.diaRange} onChange={(e) => handleChange('diaRange', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {DIA_RANGES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.tolerance} onChange={(e) => handleChange('tolerance', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {TOLERANCES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.heatTreatment} onChange={(e) => handleChange('heatTreatment', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {HEAT_TREATMENT.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.finish} onChange={(e) => handleChange('finish', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {FINISH.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.testing} onChange={(e) => handleChange('testing', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {TESTING.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={form.packaging} onChange={(e) => handleChange('packaging', e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PACKAGING.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input
              value={form.application}
              onChange={(e) => handleChange('application', e.target.value)}
              placeholder="Application (e.g. fasteners, shafts, auto parts)"
              className="md:col-span-2 xl:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-4">
            <button onClick={handleAddProduct} type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Add Product Spec
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Master Catalog</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['SKU', 'Line', 'Grade', 'Shape', 'Dia', 'Tolerance', 'HT', 'Finish', 'Testing', 'Packaging'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-sm text-center text-gray-500">
                      No product specs added yet.
                    </td>
                  </tr>
                )}
                {products.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.productLine}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.grade}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.shape}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.diaRange}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.tolerance}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.heatTreatment}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.finish}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.testing}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.packaging}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Products;
