import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, FolderOpen, ImageIcon, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GalleryFolder {
  id: string;
  title: string;
}

interface GalleryImage {
  id: string;
  folder_id: string;
  image_url: string;
  caption: string | null;
}

export default function GalleryView() {
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<GalleryFolder[]>('/gallery/folders');
        setFolders(data || []);
      } catch (error) {
        console.error('Error loading gallery folders:', error);
        setFolders([]);
      }
      setLoadingFolders(false);
    })();
  }, []);

  const openFolder = async (folder: GalleryFolder) => {
    setSelectedFolder(folder);
    setLoadingImages(true);
    try {
      const data = await apiClient.get<GalleryImage[]>(`/gallery/folders/${folder.id}/images`);
      setImages(data || []);
    } catch (error) {
      console.error('Error loading gallery images:', error);
      setImages([]);
    }
    setLoadingImages(false);
  };

  if (loadingFolders) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (selectedFolder) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFolder(null); setImages([]); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-lg font-semibold">{selectedFolder.title}</h2>
        </div>
        {loadingImages ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : images.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>No images in this folder</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {images.map(img => (
              <Card key={img.id} className="overflow-hidden group cursor-pointer" onClick={() => setPreviewImage(img)}>
                <div className="aspect-square relative">
                  <img src={img.image_url} alt={img.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                {img.caption && <CardContent className="p-2"><p className="text-xs truncate">{img.caption}</p></CardContent>}
              </Card>
            ))}
          </div>
        )}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            {previewImage && (() => {
              const currentIndex = images.findIndex(i => i.id === previewImage.id);
              const hasPrev = currentIndex > 0;
              const hasNext = currentIndex < images.length - 1;
              return (
                <div className="relative">
                  <img src={previewImage.image_url} alt={previewImage.caption || ''} className="w-full max-h-[80vh] object-contain bg-black" />
                  {hasPrev && (
                    <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-10 w-10" onClick={() => setPreviewImage(images[currentIndex - 1])}>
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  )}
                  {hasNext && (
                    <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full h-10 w-10" onClick={() => setPreviewImage(images[currentIndex + 1])}>
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  )}
                  <div className="p-3">
                    <p className="text-sm">{previewImage.caption || 'No caption'} <span className="text-muted-foreground text-xs ml-1">{currentIndex + 1}/{images.length}</span></p>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (folders.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground"><FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>No galleries available yet</p></CardContent></Card>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {folders.map(f => (
        <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFolder(f)}>
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <FolderOpen className="h-12 w-12 text-primary opacity-60" />
            <p className="font-medium text-sm text-center">{f.title}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
