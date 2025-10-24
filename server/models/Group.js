import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
name : {type : String, required : true},
description : {type : String, default : ""},
privacy : {type : String, enum : ["private", "public"], default : "public"},
members : [ {type : mongoose.Schema.Types.ObjectId, ref : "User"} ],
groupPic : {type : String, default : ""},
admins : [{type : mongoose.Schema.Types.ObjectId, ref : "User", required : true}],
latestMessage: {
    text: { type: String },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date },
    messageType: { type: String, default: "text" }, // text, image, notification
    notificationType: { type: String, default: null }, // "GROUP_NAME_CHANGE"
}
}, {
    timestamps: true
});

const Group = mongoose.model("Group", groupSchema);

export default Group;

