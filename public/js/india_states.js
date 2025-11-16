// public/js/india_states.js
// Exports STATES (object) and STATE_NAMES (array)
// Add or modify districts later as required.

export const STATES = {
  "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram"],
  "Arunachal Pradesh": ["Tawang", "West Kameng", "East Kameng", "Papum Pare", "Lower Subansiri", "Upper Subansiri", "West Siang", "East Siang"],
  "Assam": ["Kamrup Metropolitan", "Kamrup", "Dibrugarh", "Jorhat", "Sivasagar", "Nagaon", "Golaghat", "Tezpur"],
  "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Purnia", "Darbhanga", "Bhagalpur", "Begusarai"],
  "Chhattisgarh": ["Raipur", "Bastar", "Bilaspur", "Durg", "Korba", "Raigarh"],
  "Goa": ["North Goa", "South Goa"],
  "Gujarat": ["Ahmedabad", "Vadodara", "Surat", "Rajkot", "Bhavnagar", "Jamnagar"],
  "Haryana": ["Ambala", "Bhiwani", "Faridabad", "Gurugram", "Hisar", "Karnal", "Kurukshetra", "Yamuna Nagar"],
  "Himachal Pradesh": ["Shimla", "Kangra", "Mandi", "Kullu", "Solan"],
  "Jharkhand": ["Ranchi", "Dhanbad", "Jamshedpur", "Bokaro", "Hazaribagh"],
  "Karnataka": ["Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangalore", "Hubli-Dharwad", "Belagavi"],
  "Kerala": ["Thiruvananthapuram", "Kollam", "Alappuzha", "Kottayam", "Ernakulam", "Thrissur", "Kozhikode"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Sagar"],
  "Maharashtra": ["Mumbai", "Mumbai Suburban", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"],
  "Manipur": ["Imphal East", "Imphal West", "Thoubal"],
  "Meghalaya": ["East Khasi Hills", "West Khasi Hills", "Ri-Bhoi"],
  "Mizoram": ["Aizawl", "Lunglei", "Lawngtlai"],
  "Nagaland": ["Dimapur", "Kohima"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Sambalpur", "Rourkela"],
  "Punjab": ["Amritsar", "Ludhiana", "Jalandhar", "Patiala"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Ajmer", "Bikaner"],
  "Sikkim": ["Gangtok", "Namchi"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"],
  "Telangana": ["Hyderabad", "Rangareddy", "Warangal", "Karimnagar"],
  "Tripura": ["Agartala", "Unakoti"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Meerut", "Agra", "Gorakhpur"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Hooghly", "North 24 Parganas", "South 24 Parganas"]
};

export const STATE_NAMES = Object.keys(STATES).sort();