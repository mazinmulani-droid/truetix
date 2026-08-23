"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    displayOrder: 1,
    status: 'ACTIVE'
  });

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/banners');
      if (res.success) {
        setBanners(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch banners', error);
      toast.error('Failed to fetch banners list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleAddBanner = async () => {
    try {
      const payload = {
        ...formData,
        displayOrder: Number(formData.displayOrder)
      };
      const res = await api.post('/admin/banners', payload);
      if (res.success) {
        toast.success('Banner added successfully');
        setIsAddOpen(false);
        setFormData({ title: '', imageUrl: '', linkUrl: '', displayOrder: banners.length + 1, status: 'ACTIVE' });
        fetchBanners();
      } else {
        toast.error('Error adding banner');
      }
    } catch (error) {
      console.error('Failed to add banner', error);
      toast.error('Server connection error');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await api.delete(`/admin/banners/${id}`);
      if (res.success) {
        toast.success('Banner deleted');
        fetchBanners();
      }
    } catch (error) {
      console.error('Failed to toggle status', error);
      toast.error('Server connection error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.success) {
        setFormData(prev => ({ ...prev, imageUrl: res.data.url }));
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Server connection error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold border-l-4 border-primary pl-4">Manage Banners</h1>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" /> Add New Banner
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add Homepage Banner</DialogTitle>
              <DialogDescription>
                This banner will appear in the promotional hero slider on the homepage.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title / Campaign</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Summer Special 2026..." />
              </div>
              <div className="space-y-2">
                <Label>Banner Image</Label>
                <div className="flex flex-col gap-3">
                  {formData.imageUrl && (
                    <img src={formData.imageUrl} alt="Banner preview" className="w-full h-32 object-cover rounded-md border border-border" />
                  )}
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="flex-1 cursor-pointer"
                    />
                    {uploading && <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target URL (Link URL)</Label>
                <div className="flex gap-2">
                  <LinkIcon className="w-5 h-5 text-muted-foreground self-center" />
                  <Input value={formData.linkUrl} onChange={e => setFormData({...formData, linkUrl: e.target.value})} placeholder="/movies or https://..." className="flex-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input type="number" value={formData.displayOrder} onChange={e => setFormData({...formData, displayOrder: Number(e.target.value)})} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="ACTIVE">Active (Displayed)</option>
                    <option value="INACTIVE">Hidden</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddBanner} disabled={!formData.title || !formData.imageUrl}>Save Banner</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-lg overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">Image</TableHead>
              <TableHead>Banner Information</TableHead>
              <TableHead className="w-24 text-center">Order</TableHead>
              <TableHead className="w-32 text-center">Status</TableHead>
              <TableHead className="text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">Loading banners...</TableCell>
              </TableRow>
            ) : banners.length > 0 ? (
              banners.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    <div className="w-24 h-12 bg-muted rounded overflow-hidden border border-border flex items-center justify-center">
                      {banner.imageUrl ? (
                        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-bold">{banner.title}</p>
                    <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 mt-1">
                      <LinkIcon className="w-3 h-3" /> {banner.linkUrl}
                    </a>
                  </TableCell>
                  <TableCell className="text-center font-bold">{banner.displayOrder}</TableCell>
                  <TableCell className="text-center">
                    {banner.status === 'ACTIVE' ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs font-bold">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-bold">Hidden</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBanner(banner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No banners configured yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
