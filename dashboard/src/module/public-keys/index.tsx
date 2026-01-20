"use client";
import Button from "@/components/button";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import PublicKeyService, { PublicKey } from "@/services/public-keys";
import { CirclePlus, Copy, Key, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PublicKeysSkeleton = () => (
  <div className="space-y-3 px-4 pt-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className="flex items-center justify-between p-4 border border-border-blue rounded-lg"
      >
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-lg" sheen={false} />
          <Skeleton className="w-64 h-5 rounded" />
        </div>
        <Skeleton className="w-8 h-8 rounded" />
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-16 h-16 rounded-full bg-border-blue/20 flex items-center justify-center mb-4">
      <Key size={32} className="text-light-grey opacity-50" />
    </div>
    <Text size="lg" weight="semibold" variant="light-grey" className="mb-2">
      No Public Keys
    </Text>
    <Text size="sm" variant="light-grey" className="opacity-70 text-center max-w-sm">
      Add your public keys to enable wallet-based decryption and other features.
    </Text>
  </div>
);

interface PublicKeyItemProps {
  publicKey: PublicKey;
  onDelete: (address: string) => void;
  isDeleting: boolean;
}

const PublicKeyItem = ({ publicKey, onDelete, isDeleting }: PublicKeyItemProps) => {
  const toast = useAppToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicKey.public_address);
      toast.success({ label: "Copied!", description: "Public key copied to clipboard" });
    } catch {
      toast.error({ label: "Failed", description: "Could not copy to clipboard" });
    }
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="flex items-center justify-between p-4 border border-border-blue rounded-lg hover:border-blue/50 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/30 to-blue/10 flex items-center justify-center border border-blue/20">
          <Key size={20} className="text-blue" />
        </div>
        <div className="flex flex-col">
          <Text size="sm" weight="semibold" className="font-mono">
            {truncateAddress(publicKey.public_address)}
          </Text>
          <Text size="xs" variant="light-grey" className="opacity-60">
            Added {new Date(publicKey.created_at).toLocaleDateString()}
          </Text>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={copyToClipboard}
          className="p-2 rounded-lg hover:bg-border-blue/30 transition-colors opacity-0 group-hover:opacity-100"
          title="Copy address"
        >
          <Copy size={16} className="text-light-grey" />
        </button>
        <button
          onClick={() => onDelete(publicKey.public_address)}
          disabled={isDeleting}
          className="p-2 rounded-lg hover:bg-[#CF6679]/20 transition-colors text-[#CF6679] disabled:opacity-50"
          title="Delete key"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const AddPublicKeyDialog = ({
  isOpen,
  onClose,
  onAdd,
  isAdding,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (address: string) => Promise<void>;
  isAdding: boolean;
}) => {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError("Please enter a public address");
      return;
    }

    // Basic validation - check if it looks like an address
    if (!address.startsWith("0x") || address.length < 42) {
      setError("Please enter a valid public address (0x...)");
      return;
    }

    setError("");
    await onAdd(address.trim());
    setAddress("");
  };

  const handleClose = () => {
    setAddress("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-bg-primary border-border-blue max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Text size="xl" weight="semibold">
              Add Public Key
            </Text>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <PrimaryInput
            label="Public Address"
            placeholder="0x..."
            value={address}
            onChange={setAddress}
            error={error}
          />
          <Text size="xs" variant="light-grey" className="mt-2 opacity-70">
            Enter the public address you want to associate with your account.
          </Text>
        </div>
        <DialogFooter className="gap-3">
          <DialogClose asChild>
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            disabled={isAdding || !address.trim()}
          >
            {isAdding ? "Adding..." : "Add Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  address,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  address: string;
}) => {
  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-bg-primary border-border-blue max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Text size="xl" weight="semibold">
              Delete Public Key
            </Text>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Text size="sm" variant="light-grey">
            Are you sure you want to delete this public key?
          </Text>
          <div className="mt-3 p-3 bg-border-blue/20 rounded-lg">
            <Text size="sm" weight="medium" className="font-mono">
              {truncateAddress(address)}
            </Text>
          </div>
          <Text size="xs" variant="light-grey" className="mt-3 opacity-70">
            This action cannot be undone.
          </Text>
        </div>
        <DialogFooter className="gap-3">
          <DialogClose asChild>
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PublicKeysCard = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuthState();
  const { token } = useConfig();
  const toast = useAppToast();

  const [publicKeys, setPublicKeys] = useState<PublicKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteAddress, setDeleteAddress] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPublicKeys = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await PublicKeyService.getPublicKeys({ token });
      if (response.state === "SUCCESS" && Array.isArray(response.data)) {
        setPublicKeys(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch public keys:", error);
      toast.error({ label: "Error", description: "Failed to load public keys" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPublicKeys();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchPublicKeys]);

  const handleAdd = async (address: string) => {
    if (!token) return;

    try {
      setIsAdding(true);
      const response = await PublicKeyService.addPublicKey({ token, publicAddress: address });

      if (response.state === "SUCCESS") {
        toast.success({ label: "Success", description: "Public key added successfully" });
        setIsAddDialogOpen(false);
        fetchPublicKeys();
      } else {
        toast.error({ label: "Error", description: response.error || "Failed to add public key" });
      }
    } catch (error) {
      console.error("Failed to add public key:", error);
      toast.error({ label: "Error", description: "Failed to add public key" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteAddress) return;

    try {
      setIsDeleting(true);
      const response = await PublicKeyService.deletePublicKey({ token, publicAddress: deleteAddress });

      if (response.state === "SUCCESS") {
        toast.success({ label: "Success", description: "Public key deleted successfully" });
        setDeleteAddress(null);
        fetchPublicKeys();
      } else {
        toast.error({ label: "Error", description: response.error || "Failed to delete public key" });
      }
    } catch (error) {
      console.error("Failed to delete public key:", error);
      toast.error({ label: "Error", description: "Failed to delete public key" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <>
      <div className={cn("relative w-full")}>
        <div className="w-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px overflow-hidden">
          <Card className="shadow-primary border-none bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary rounded-2xl to-[100%] pt-0 gap-0 flex-1 pb-0 block relative">
            <CardHeader className="p-4 border-b border-border-blue gap-0 z-1 relative">
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Text size={"xl"} weight={"bold"} variant={"light-grey"}>
                    Public Keys {publicKeys.length ? `(${publicKeys.length})` : null}
                  </Text>
                </CardTitle>
                <Button
                  variant="link"
                  className="flex gap-x-1 items-center cursor-pointer underline underline-offset-[2.5px]"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <CirclePlus size={24} color="#B3B3B3" strokeWidth={1} />
                  <Text size={"sm"} weight={"semibold"} variant={"secondary-grey"}>
                    Add New
                  </Text>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-4 min-h-[200px]">
              {loading ? (
                <PublicKeysSkeleton />
              ) : publicKeys.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  <Text size="sm" weight="medium" variant="light-grey" className="mb-4">
                    Your registered public keys for wallet-based authentication and decryption.
                  </Text>
                  {publicKeys.map((key) => (
                    <PublicKeyItem
                      key={key.id}
                      publicKey={key}
                      onDelete={setDeleteAddress}
                      isDeleting={isDeleting && deleteAddress === key.public_address}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddPublicKeyDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAdd}
        isAdding={isAdding}
      />

      <DeleteConfirmDialog
        isOpen={!!deleteAddress}
        onClose={() => setDeleteAddress(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        address={deleteAddress || ""}
      />
    </>
  );
};

export default PublicKeysCard;
