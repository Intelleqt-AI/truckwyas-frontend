"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, ArchiveRestore } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const DeleteDialog = ({
  isOpen,
  onClose,
  onConfirm,
  id = null,
  title = "Delete Project",
  description = "Are you sure you want to delete this project? This action cannot be undone.",
  itemName = "",
  confirmText = "Delete",
  cancelText = "Cancel",
  requireConfirmation = false,
  confirmationText = "confirm",
  isArchive = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const isConfirmationValid =
    !requireConfirmation || confirmationInput.trim() === confirmationText;

  const handleConfirm = async () => {
    if (!isConfirmationValid) return;

    setIsDeleting(true);
    try {
      const result = await onConfirm(id);
      onClose();
      setConfirmationInput("");
      return result || id;
    } catch (error) {
      console.error("Delete failed:", error);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmationInput("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg z-[999]">
        <DialogHeader className="flex flex-row items-center gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 ${isArchive ? "bg-gray-100" : "bg-red-100"
              }  rounded-full flex items-center justify-center`}>
            <AlertTriangle
              className={`w-5 h-5 ${isArchive ? "text-black" : "text-red-600"
                } `}
            />
          </div>
          <div>
            <DialogTitle>{title}</DialogTitle>
            {itemName && (
              <p className="text-sm text-muted-foreground mt-1">"{itemName}"</p>
            )}
          </div>
        </DialogHeader>

        <DialogDescription className="text-sm text-muted-foreground">
          {description}
        </DialogDescription>

        {requireConfirmation && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-700">
              To confirm deletion, please type{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 font-mono text-xs">
                {confirmationText}
              </code>{" "}
              below:
            </p>
            <Input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={`Type "${confirmationText}" to confirm`}
              disabled={isDeleting}
            />
          </div>
        )}

        <DialogFooter className="mt-3 flex gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}>
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isArchive ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={isDeleting || !isConfirmationValid}>
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Deleting...
              </>
            ) : (
              <>
                {isArchive ? (
                  <ArchiveRestore className="w-4 h-4 mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
