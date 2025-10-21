import { Edit3, Check, X } from "lucide-react";
import { useState } from "react";

const GroupInfoCard = ({ description, isAdmin, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(description || "");

  const handleSave = () => {
    onSave(desc);
    setIsEditing(false);
  };

  return (
    <div className="mt-4 rounded-2xl p-4 w-full  transition-all duration-200">
      <h3 className="text-white/80 text-sm font-semibold mb-4 tracking-wide">
        Group Description
      </h3>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full bg-[#101020] text-white/90 text-sm p-3 rounded-lg border border-violet-500/30 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40 outline-none resize-none transition-all duration-200"
            rows={3}
            placeholder="Write something about your group..."
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs hover:font-bold cursor-pointer text-gray-300 border-[2px] hover:bg-[#b60546] border-[#e70008] rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs cursor-pointer bg-violet-600/80 hover:bg-violet-800 transition-all text-white font-medium rounded-lg flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      ) : (
 <div className="relative bg-white/5 border border-white/10 h-auto min-h-20 rounded p-3 backdrop-blur-md shadow-[0_0_15px_rgba(138,43,226,0.15)] group">
  <p
    className={`text-sm text-white/70 leading-relaxed break-words whitespace-pre-wrap ${
      desc ? "italic" : "text-white/40"
    }`}
  >
    {desc || "No description added yet..."}
  </p>

  {isAdmin && (
    <button
      onClick={() => setIsEditing(true)}
      className="absolute top-2 right-2 opacity-80 hover:opacity-100  transition-opacity duration-200 text-violet-400 hover:text-violet-300"
      title="Edit Description"
    >
      <Edit3 className="w-4 h-4 cursor-pointer hover:scale-110" />
    </button>
  )}
</div>

      )}
    </div>
  );
};

export default GroupInfoCard;
