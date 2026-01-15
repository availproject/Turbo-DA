"use client";
import Button from "@/components/button";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { useConfig } from "@/providers/ConfigProvider";
import EnigmaService from "@/services/enigma";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

const ManageParticipants = () => {
  const { token } = useConfig();
  const { success, error: errorToast } = useAppToast();
  
  const [addLoading, setAddLoading] = useState(false);
  const [addAppId, setAddAppId] = useState("");
  const [addParticipants, setAddParticipants] = useState("");

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteAppId, setDeleteAppId] = useState("");
  const [deleteParticipants, setDeleteParticipants] = useState("");

  const handleAdd = async () => {
    if (!token) return;
    if (!addAppId || !addParticipants) {
      errorToast({ label: "Please fill all fields" });
      return;
    }

    try {
      setAddLoading(true);
      const participantsList = addParticipants.split(",").map((p) => p.trim()).filter((p) => p);
      
      const response = await EnigmaService.addParticipant({
        token,
        turbo_da_app_id: addAppId,
        participants: participantsList,
      });

      success({
        label: "Participants Added Successfully",
        description: `Added ${response.participants_added} participants to ${response.turbo_da_app_id}`,
      });
      
      setAddAppId("");
      setAddParticipants("");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to add participants" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    if (!deleteAppId || !deleteParticipants) {
      errorToast({ label: "Please fill all fields" });
      return;
    }

    try {
      setDeleteLoading(true);
      const participantsList = deleteParticipants.split(",").map((p) => p.trim()).filter((p) => p);
      
      const response = await EnigmaService.deleteParticipant({
        token,
        turbo_da_app_id: deleteAppId,
        participants: participantsList,
      });

      success({
        label: "Participants Deleted Successfully",
        description: `Deleted ${response.participants_deleted} participants from ${response.turbo_da_app_id}`,
      });
      
      setDeleteAppId("");
      setDeleteParticipants("");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to delete participants" });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      {/* Add Participants Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">Add Participants</Text>
          <Text variant="light-grey" size="sm">
            Add new participants to an existing app.
          </Text>
        </div>

        <PrimaryInput
          label="Turbo DA App ID"
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          value={addAppId}
          onChange={setAddAppId}
        />

        <PrimaryInput
          label="Participants (Comma separated addresses)"
          placeholder="e.g. 0x123..., 0x456..."
          value={addParticipants}
          onChange={setAddParticipants}
        />

        <Button
          className="mt-2"
          onClick={handleAdd}
          disabled={addLoading}
        >
          {addLoading ? <LoaderCircle className="animate-spin" /> : "Add Participants"}
        </Button>
      </div>

      {/* Delete Participants Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">Remove Participants</Text>
          <Text variant="light-grey" size="sm">
            Remove participants from an existing app.
          </Text>
        </div>

        <PrimaryInput
          label="Turbo DA App ID"
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          value={deleteAppId}
          onChange={setDeleteAppId}
        />

        <PrimaryInput
          label="Participants (Comma separated addresses)"
          placeholder="e.g. 0x123..., 0x456..."
          value={deleteParticipants}
          onChange={setDeleteParticipants}
        />

        <Button
          variant="danger"
          className="mt-2"
          onClick={handleDelete}
          disabled={deleteLoading}
        >
          {deleteLoading ? <LoaderCircle className="animate-spin" /> : "Remove Participants"}
        </Button>
      </div>
    </div>
  );
};

export default ManageParticipants;
