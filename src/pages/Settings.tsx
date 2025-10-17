import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [whatsappQRFile, setWhatsappQRFile] = useState<File | null>(null);
  const [whatsappQRPreview, setWhatsappQRPreview] = useState<string>("");
  const [instagramQRFile, setInstagramQRFile] = useState<File | null>(null);
  const [instagramQRPreview, setInstagramQRPreview] = useState<string>("");

  const { data: settings, isLoading, error: settingsError } = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_settings").select("*").maybeSingle();
      if (error) {
        console.error("Error fetching settings:", error);
        throw error;
      }

      // If no settings exist, create default settings
      if (!data) {
        const { data: newSettings, error: createError } = await supabase
          .from("store_settings")
          .insert({
            store_name: "My Garment Store",
            currency_symbol: "₹",
            tax_percentage: 18,
            low_stock_threshold: 10
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating settings:", createError);
          throw createError;
        }
        return newSettings;
      }

      return data;
    },
    retry: 1,
    retryDelay: 1000,
  });

  const { data: userResponse } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      return await supabase.auth.getUser();
    },
  });
  
  const user = userResponse?.data?.user;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!settings) throw new Error("No settings found");
      const { error } = await supabase.from("store_settings").update(data).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: (error) => {
      console.error("Settings update error:", error);
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  const handleFileUpload = async (file: File, type: 'logo' | 'whatsapp-qr' | 'instagram-qr') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error(`${type} upload error:`, error);
      toast({ title: `Failed to upload ${type}`, variant: "destructive" });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let logoUrl = settings?.logo_url;
    let whatsappQRUrl = settings?.whatsapp_qr_url;
    let instagramQRUrl = settings?.instagram_qr_url;

    if (logoFile) {
      const uploadedUrl = await handleFileUpload(logoFile, 'logo');
      if (uploadedUrl) logoUrl = uploadedUrl;
    }

    if (whatsappQRFile) {
      const uploadedUrl = await handleFileUpload(whatsappQRFile, 'whatsapp-qr');
      if (uploadedUrl) whatsappQRUrl = uploadedUrl;
    }

    if (instagramQRFile) {
      const uploadedUrl = await handleFileUpload(instagramQRFile, 'instagram-qr');
      if (uploadedUrl) instagramQRUrl = uploadedUrl;
    }
    
    const updates = {
      store_name: formData.get("store_name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      tax_percentage: parseFloat(formData.get("tax_percentage") as string) || 0,
      currency_symbol: formData.get("currency_symbol") as string,
      low_stock_threshold: parseInt(formData.get("low_stock_threshold") as string) || 10,
      whatsapp_channel_name: (formData.get("whatsapp_channel_name") as string) || '',
      instagram_page_id: (formData.get("instagram_page_id") as string) || '',
      whatsapp_tagline: (formData.get("whatsapp_tagline") as string) || 'Join our WhatsApp group',
      instagram_tagline: (formData.get("instagram_tagline") as string) || 'Follow us on Instagram',
      logo_url: logoUrl,
      whatsapp_qr_url: whatsappQRUrl,
      instagram_qr_url: instagramQRUrl
    };

    updateMutation.mutate(updates);
    setLogoFile(null);
    setLogoPreview("");
    setWhatsappQRFile(null);
    setWhatsappQRPreview("");
    setInstagramQRFile(null);
    setInstagramQRPreview("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      const tables = [
        'invoice_items',
        'invoices',
        'products',
        'categories',
        'sizes',
        'user_roles',
        'store_settings'
      ];

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }

      const { data: productImages } = await supabase.storage.from('product-images').list();
      if (productImages) {
        const filePaths = productImages.map(file => file.name);
        if (filePaths.length > 0) {
          await supabase.storage.from('product-images').remove(filePaths);
        }
      }

      const { data: storeAssets } = await supabase.storage.from('store-assets').list();
      if (storeAssets) {
        const filePaths = storeAssets.map(file => file.name);
        if (filePaths.length > 0) {
          await supabase.storage.from('store-assets').remove(filePaths);
        }
      }

      const { data: newSettings, error: createError } = await supabase
        .from("store_settings")
        .insert({
          store_name: "My Garment Store",
          currency_symbol: "₹",
          tax_percentage: 18
        })
        .select()
        .single();

      if (createError) throw createError;

      const defaultSizes = [
        { name: 'XS', sort_order: 1 },
        { name: 'S', sort_order: 2 },
        { name: 'M', sort_order: 3 },
        { name: 'L', sort_order: 4 },
        { name: 'XL', sort_order: 5 },
        { name: 'XXL', sort_order: 6 },
        { name: 'XXXL', sort_order: 7 }
      ];

      const { error: sizesError } = await supabase.from('sizes').insert(defaultSizes);
      if (sizesError) throw sizesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: "All data deleted successfully",
        description: "Your store has been reset to default settings"
      });
    },
    onError: (error) => {
      console.error("Delete all data error:", error);
      toast({
        title: "Failed to delete data",
        description: "An error occurred while deleting data",
        variant: "destructive"
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Error loading settings</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["store-settings"] })} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Store Settings</h1>

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">General Settings</h3>
          <p className="text-sm text-muted-foreground">Manage your store information and preferences</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Store Logo</Label>
            <div className="flex items-center gap-4">
              {(logoPreview || settings?.logo_url) && (
                <div className="relative">
                  <img 
                    src={logoPreview || settings?.logo_url} 
                    alt="Store Logo" 
                    className="h-20 w-20 object-contain border rounded"
                  />
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview("");
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              <div>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Label htmlFor="logo" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      {logoPreview || settings?.logo_url ? "Change Logo" : "Upload Logo"}
                    </span>
                  </Button>
                </Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Store Name *</Label>
              <Input id="store_name" name="store_name" defaultValue={settings?.store_name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_symbol">Currency Symbol</Label>
              <Input id="currency_symbol" name="currency_symbol" defaultValue={settings?.currency_symbol} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={settings?.email || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={settings?.phone || ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={settings?.address || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_percentage">Default Tax Percentage (%)</Label>
            <Input id="tax_percentage" name="tax_percentage" type="number" step="0.01" min="0" defaultValue={settings?.tax_percentage || ""} placeholder="0" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
            <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" defaultValue={settings?.low_stock_threshold || 10} placeholder="10" />
          </div>

          <div className="mb-6 mt-8">
            <h3 className="text-lg font-semibold">Social Media Settings</h3>
            <p className="text-sm text-muted-foreground">Upload QR codes and add details to display on invoices</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>WhatsApp QR Code</Label>
                <div className="flex items-center gap-4">
                  {(whatsappQRPreview || settings?.whatsapp_qr_url) && (
                    <div className="relative">
                      <img
                        src={whatsappQRPreview || settings?.whatsapp_qr_url}
                        alt="WhatsApp QR"
                        className="h-24 w-24 object-contain border rounded"
                      />
                      {whatsappQRPreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => {
                            setWhatsappQRFile(null);
                            setWhatsappQRPreview("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  <div>
                    <Input
                      id="whatsapp_qr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setWhatsappQRFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setWhatsappQRPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Label htmlFor="whatsapp_qr" className="cursor-pointer">
                      <Button type="button" variant="outline" asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          {whatsappQRPreview || settings?.whatsapp_qr_url ? "Change QR" : "Upload QR"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp_tagline">WhatsApp Tagline</Label>
                <Input id="whatsapp_tagline" name="whatsapp_tagline" defaultValue={settings?.whatsapp_tagline || "Join our WhatsApp group"} placeholder="Join our WhatsApp group" />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Instagram QR Code</Label>
                <div className="flex items-center gap-4">
                  {(instagramQRPreview || settings?.instagram_qr_url) && (
                    <div className="relative">
                      <img
                        src={instagramQRPreview || settings?.instagram_qr_url}
                        alt="Instagram QR"
                        className="h-24 w-24 object-contain border rounded"
                      />
                      {instagramQRPreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => {
                            setInstagramQRFile(null);
                            setInstagramQRPreview("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  <div>
                    <Input
                      id="instagram_qr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setInstagramQRFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setInstagramQRPreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Label htmlFor="instagram_qr" className="cursor-pointer">
                      <Button type="button" variant="outline" asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          {instagramQRPreview || settings?.instagram_qr_url ? "Change QR" : "Upload QR"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_tagline">Instagram Tagline</Label>
                <Input id="instagram_tagline" name="instagram_tagline" defaultValue={settings?.instagram_tagline || "Follow us on Instagram"} placeholder="Follow us on Instagram" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border bg-card p-6 border-destructive">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">Permanently delete all store data. This action cannot be undone.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Store Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all data from your store including:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All products and inventory</li>
                  <li>All invoices and sales records</li>
                  <li>All categories and sizes</li>
                  <li>All uploaded images</li>
                  <li>Store settings will be reset to defaults</li>
                </ul>
                <p className="mt-3 font-semibold text-destructive">This action cannot be undone!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllDataMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Delete Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
