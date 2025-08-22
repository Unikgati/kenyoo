import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { useData } from '../context/DataContext';
import Input from './ui/Input';
import NumberInput from './ui/NumberInput';
import Button from './ui/Button';
import Select from './ui/Select';

interface ProductFormProps {
  product: Product | null;
  onSave: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave }) => {
  const { addProduct, updateProduct } = useData();
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: '',
    price: 0,
    commission: 0,
    imageUrl: '',
    status: 'active',
  });

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({ name: '', price: 0, commission: 0, imageUrl: 'https://res.cloudinary.com/dkwzjccok/image/upload/v1755756381/1062056d-ed24-4004-8be0-b4ed47c35360_tbezse.webp', status: 'active' });
    }
  }, [product]);

  // Format number with thousand separator
  const formatNumber = (value: string): string => {
    // Remove existing non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    
    // Split the number into integer and decimal parts
    const [integer, decimal] = cleanValue.split('.');
    
    // Format integer part with thousand separator
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Return formatted number with decimal if exists
    return decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger;
  };

  // Parse formatted number back to raw number
  const parseFormattedNumber = (value: string): number => {
    // Remove thousand separators and convert to number
    return parseFloat(value.replace(/\./g, '')) || 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'price' || name === 'commission') {
      // For price and commission, handle formatting
      const formattedValue = formatNumber(value);
      e.target.value = formattedValue;
      
      // Store the actual number value in state
      setFormData(prev => ({
        ...prev,
        [name]: parseFormattedNumber(formattedValue)
      }));
    } else {
      // For other fields, handle normally
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (product) {
      updateProduct({ ...product, ...formData });
    } else {
      addProduct(formData);
    }
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground/80 mb-1">Product Name</label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-foreground/80 mb-1">Price</label>
          <NumberInput 
            id="price" 
            name="price" 
            value={formData.price} 
            onChange={(value) => setFormData(prev => ({ ...prev, price: value }))}
            placeholder="0"
            required 
          />
        </div>
        <div>
          <label htmlFor="commission" className="block text-sm font-medium text-foreground/80 mb-1">Commission</label>
          <NumberInput 
            id="commission" 
            name="commission" 
            value={formData.commission} 
            onChange={(value) => setFormData(prev => ({ ...prev, commission: value }))}
            placeholder="0"
            required 
          />
        </div>
      </div>
      <div>
        <label htmlFor="imageUrl" className="block text-sm font-medium text-foreground/80 mb-1">Image URL</label>
        <Input id="imageUrl" name="imageUrl" value={formData.imageUrl} onChange={handleChange} required />
      </div>
       <div>
        <label htmlFor="status" className="block text-sm font-medium text-foreground/80 mb-1">Status</label>
        <Select id="status" name="status" value={formData.status} onChange={handleChange}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
      <div className="flex justify-end pt-4 space-x-2">
        <Button type="button" variant="secondary" onClick={onSave}>Cancel</Button>
        <Button type="submit">Save Product</Button>
      </div>
    </form>
  );
};

export default ProductForm;