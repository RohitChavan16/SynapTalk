import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Mail, Users, ArrowLeft } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";

function Contacts() {
  const navigate = useNavigate();
  const { authUser, token, axios } = useContext(AuthContext);

  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch contacts after token is available
  useEffect(() => {
    if (!token) return; // wait until token exists
    fetchContacts();
  }, [token]);

  // Filter contacts when search query changes
  useEffect(() => {
    const filtered = contacts.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const fetchContacts = async () => {
      try {
    const { data } = await axios.get("/api/auth/google/contacts", {
      headers: { Authorization: `Bearer ${token}` } // <- must match backend
    });
    setContacts(data.contacts);
  } catch (err) {
    console.error("Failed to fetch contacts:", err.response?.data || err.message);
  }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getGradientColor = (name) => {
    if (!name) return "from-gray-400 to-gray-600";
    const colors = [
      "from-blue-400 to-blue-600",
      "from-purple-400 to-purple-600",
      "from-pink-400 to-pink-600",
      "from-red-400 to-red-600",
      "from-orange-400 to-orange-600",
      "from-yellow-400 to-yellow-600",
      "from-green-400 to-green-600",
      "from-teal-400 to-teal-600",
      "from-cyan-400 to-cyan-600",
      "from-indigo-400 to-indigo-600",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const ContactAvatar = ({ contact }) => {
    const [imageError, setImageError] = useState(false);

    if (contact.avatar && !imageError) {
      return (
        <img
          src={contact.avatar}
          alt={contact.name}
          className="w-12 h-12 rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      );
    }

    return (
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${getGradientColor(
          contact.name
        )} flex items-center justify-center text-white font-semibold text-lg shadow-md`}
      >
        {getInitials(contact.name)}
      </div>
    );
  };

  const displayContacts = searchQuery ? filteredContacts : contacts;

  return (
    <div className="min-h-screen backdrop-blur-2xl w-200 mx-auto bg-white/10 ">
      {/* Header */}
      <div className=" shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-gray-500 cursor-pointer rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-200" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-400 flex items-center">
                  <Users className="w-6 h-6 mr-2 text-blue-600" />
                  Invite Contacts
                </h1>
                <p className="text-gray-300 text-sm mt-1">
                  Select contacts to invite to your chat
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contacts by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {displayContacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "No contacts found" : "No contacts available"}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Import contacts from your Google account to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="mb-4 text-sm text-gray-600">
              {displayContacts.length} contact
              {displayContacts.length !== 1 ? "s" : ""} found
            </div>

            {/* Contacts List */}
            <div className="grid gap-3">
              {displayContacts.map((c, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <ContactAvatar contact={c} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {c.name}
                      </h3>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Mail className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 hover:text-blue-700 transition-colors">
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Contacts;
