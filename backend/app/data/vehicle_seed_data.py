"""
Comprehensive vehicle makes and models data for seeding the database.
Focused on European and popular international brands.
"""

VEHICLE_MAKES = [
    # European Brands
    "Audi", "BMW", "Mercedes-Benz", "Volkswagen", "Porsche",
    "Renault", "Peugeot", "Citroën", "Opel", "Fiat",
    "Alfa Romeo", "Ferrari", "Lamborghini", "Maserati", "Lancia",
    "Seat", "Skoda", "Volvo", "Saab",
    # Japanese Brands
    "Toyota", "Honda", "Nissan", "Mazda", "Subaru",
    "Mitsubishi", "Suzuki", "Lexus", "Infiniti",
    # Korean Brands
    "Hyundai", "Kia", "Genesis",
    # American Brands
    "Ford", "Chevrolet", "Jeep", "Dodge", "Tesla",
    "Chrysler", "GMC", "Cadillac", "Lincoln",
    # British Brands
    "Land Rover", "Jaguar", "Mini", "Aston Martin", "Bentley", "Rolls-Royce",
]

# Popular models with average dimensions (length, width, height in cm)
VEHICLE_MODELS = [
    # Renault (French - very popular in Europe/Tunisia)
    ("Renault", "Clio", "hatchback", 405, 173, 143),
    ("Renault", "Megane", "hatchback", 436, 181, 144),
    ("Renault", "Captur", "suv", 417, 179, 158),
    ("Renault", "Kadjar", "suv", 436, 183, 161),
    ("Renault", "Scenic", "mpv", 464, 184, 165),
    ("Renault", "Koleos", "suv", 467, 186, 167),
    ("Renault", "Trafic", "van", 495, 195, 190),

    # Peugeot (French - very popular)
    ("Peugeot", "208", "hatchback", 406, 174, 143),
    ("Peugeot", "308", "hatchback", 433, 180, 148),
    ("Peugeot", "2008", "suv", 416, 177, 155),
    ("Peugeot", "3008", "suv", 448, 184, 162),
    ("Peugeot", "5008", "suv", 464, 184, 165),
    ("Peugeot", "Partner", "van", 459, 184, 185),
    ("Peugeot", "Expert", "van", 495, 192, 190),

    # Citroën (French)
    ("Citroën", "C3", "hatchback", 399, 175, 148),
    ("Citroën", "C4", "hatchback", 430, 179, 152),
    ("Citroën", "C5 Aircross", "suv", 444, 184, 167),
    ("Citroën", "Berlingo", "van", 450, 184, 185),
    ("Citroën", "Jumpy", "van", 495, 192, 190),

    # Fiat (Italian - popular in Mediterranean)
    ("Fiat", "500", "hatchback", 357, 163, 149),
    ("Fiat", "Panda", "hatchback", 365, 164, 155),
    ("Fiat", "Tipo", "sedan", 452, 179, 149),
    ("Fiat", "500X", "suv", 426, 179, 161),
    ("Fiat", "Ducato", "van", 540, 205, 254),

    # Volkswagen (German - very popular)
    ("Volkswagen", "Polo", "hatchback", 408, 175, 146),
    ("Volkswagen", "Golf", "hatchback", 430, 179, 145),
    ("Volkswagen", "Passat", "sedan", 486, 183, 147),
    ("Volkswagen", "Tiguan", "suv", 447, 183, 167),
    ("Volkswagen", "Touran", "mpv", 446, 183, 169),
    ("Volkswagen", "T-Roc", "suv", 425, 181, 159),
    ("Volkswagen", "Caddy", "van", 468, 186, 184),
    ("Volkswagen", "Transporter", "van", 490, 190, 199),
    ("Volkswagen", "Crafter", "van", 598, 207, 263),

    # Audi (German)
    ("Audi", "A1", "hatchback", 404, 174, 142),
    ("Audi", "A3", "hatchback", 437, 179, 142),
    ("Audi", "A4", "sedan", 475, 184, 143),
    ("Audi", "A6", "sedan", 493, 188, 145),
    ("Audi", "Q2", "suv", 419, 179, 150),
    ("Audi", "Q3", "suv", 447, 184, 161),
    ("Audi", "Q5", "suv", 466, 189, 166),
    ("Audi", "Q7", "suv", 505, 199, 174),

    # BMW (German)
    ("BMW", "1 Series", "hatchback", 434, 178, 144),
    ("BMW", "2 Series", "coupe", 447, 179, 141),
    ("BMW", "3 Series", "sedan", 470, 182, 143),
    ("BMW", "5 Series", "sedan", 495, 186, 148),
    ("BMW", "X1", "suv", 447, 182, 159),
    ("BMW", "X3", "suv", 474, 189, 167),
    ("BMW", "X5", "suv", 492, 200, 176),

    # Mercedes-Benz (German)
    ("Mercedes-Benz", "A-Class", "hatchback", 443, 179, 144),
    ("Mercedes-Benz", "C-Class", "sedan", 476, 181, 144),
    ("Mercedes-Benz", "E-Class", "sedan", 493, 185, 145),
    ("Mercedes-Benz", "GLA", "suv", 444, 183, 161),
    ("Mercedes-Benz", "GLC", "suv", 467, 189, 164),
    ("Mercedes-Benz", "Vito", "van", 514, 191, 193),
    ("Mercedes-Benz", "Sprinter", "van", 598, 205, 263),

    # Toyota (Japanese - very reliable)
    ("Toyota", "Yaris", "hatchback", 395, 174, 151),
    ("Toyota", "Corolla", "sedan", 460, 180, 145),
    ("Toyota", "Camry", "sedan", 490, 184, 144),
    ("Toyota", "RAV4", "suv", 460, 185, 168),
    ("Toyota", "C-HR", "suv", 436, 179, 155),
    ("Toyota", "Land Cruiser", "suv", 490, 198, 193),
    ("Toyota", "Hilux", "truck", 533, 185, 181),
    ("Toyota", "Proace", "van", 495, 192, 190),

    # Honda (Japanese)
    ("Honda", "Jazz", "hatchback", 399, 169, 153),
    ("Honda", "Civic", "sedan", 461, 180, 142),
    ("Honda", "Accord", "sedan", 484, 185, 145),
    ("Honda", "CR-V", "suv", 458, 185, 168),
    ("Honda", "HR-V", "suv", 434, 177, 160),

    # Nissan (Japanese)
    ("Nissan", "Micra", "hatchback", 396, 166, 145),
    ("Nissan", "Juke", "suv", 421, 179, 158),
    ("Nissan", "Qashqai", "suv", 443, 183, 159),
    ("Nissan", "X-Trail", "suv", 473, 184, 171),
    ("Nissan", "Navara", "truck", 531, 185, 181),

    # Ford (American/European)
    ("Ford", "Fiesta", "hatchback", 404, 173, 147),
    ("Ford", "Focus", "hatchback", 437, 182, 147),
    ("Ford", "Mondeo", "sedan", 487, 186, 148),
    ("Ford", "Kuga", "suv", 456, 188, 169),
    ("Ford", "EcoSport", "suv", 408, 176, 167),
    ("Ford", "Ranger", "truck", 531, 185, 181),
    ("Ford", "Transit", "van", 532, 208, 226),
    ("Ford", "Transit Custom", "van", 492, 196, 199),

    # Hyundai (Korean)
    ("Hyundai", "i10", "hatchback", 367, 165, 148),
    ("Hyundai", "i20", "hatchback", 406, 173, 146),
    ("Hyundai", "i30", "hatchback", 436, 179, 144),
    ("Hyundai", "Tucson", "suv", 446, 185, 165),
    ("Hyundai", "Santa Fe", "suv", 475, 190, 176),
    ("Hyundai", "Kona", "suv", 417, 180, 155),

    # Kia (Korean)
    ("Kia", "Picanto", "hatchback", 366, 159, 148),
    ("Kia", "Rio", "hatchback", 406, 172, 145),
    ("Kia", "Ceed", "hatchback", 437, 180, 144),
    ("Kia", "Sportage", "suv", 446, 185, 165),
    ("Kia", "Sorento", "suv", 481, 189, 170),
    ("Kia", "Stonic", "suv", 410, 176, 152),

    # Opel (German/French)
    ("Opel", "Corsa", "hatchback", 406, 173, 143),
    ("Opel", "Astra", "hatchback", 433, 180, 148),
    ("Opel", "Insignia", "sedan", 490, 187, 147),
    ("Opel", "Crossland", "suv", 416, 177, 163),
    ("Opel", "Grandland", "suv", 448, 184, 163),
    ("Opel", "Combo", "van", 463, 184, 185),

    # Seat (Spanish/VW Group)
    ("Seat", "Ibiza", "hatchback", 408, 178, 144),
    ("Seat", "Leon", "hatchback", 433, 179, 144),
    ("Seat", "Arona", "suv", 416, 179, 154),
    ("Seat", "Ateca", "suv", 443, 184, 161),

    # Skoda (Czech/VW Group)
    ("Skoda", "Fabia", "hatchback", 408, 175, 145),
    ("Skoda", "Octavia", "sedan", 468, 183, 146),
    ("Skoda", "Superb", "sedan", 486, 186, 148),
    ("Skoda", "Kamiq", "suv", 419, 179, 153),
    ("Skoda", "Karoq", "suv", 443, 184, 161),
    ("Skoda", "Kodiaq", "suv", 469, 188, 167),

    # Mazda (Japanese)
    ("Mazda", "2", "hatchback", 405, 169, 149),
    ("Mazda", "3", "hatchback", 459, 179, 144),
    ("Mazda", "6", "sedan", 489, 184, 145),
    ("Mazda", "CX-3", "suv", 427, 176, 155),
    ("Mazda", "CX-5", "suv", 454, 184, 166),
    ("Mazda", "CX-30", "suv", 436, 179, 154),

    # Volvo (Swedish)
    ("Volvo", "V40", "hatchback", 443, 179, 144),
    ("Volvo", "S60", "sedan", 474, 185, 144),
    ("Volvo", "S90", "sedan", 494, 189, 144),
    ("Volvo", "XC40", "suv", 442, 186, 165),
    ("Volvo", "XC60", "suv", 469, 189, 166),
    ("Volvo", "XC90", "suv", 490, 193, 177),

    # Alfa Romeo (Italian)
    ("Alfa Romeo", "Giulietta", "hatchback", 443, 179, 146),
    ("Alfa Romeo", "Giulia", "sedan", 467, 186, 142),
    ("Alfa Romeo", "Stelvio", "suv", 467, 190, 168),

    # Mini (British/BMW)
    ("Mini", "Cooper", "hatchback", 386, 172, 141),
    ("Mini", "Countryman", "suv", 434, 182, 155),

    # Land Rover (British)
    ("Land Rover", "Discovery Sport", "suv", 465, 190, 172),
    ("Land Rover", "Range Rover Evoque", "suv", 437, 190, 164),
    ("Land Rover", "Defender", "suv", 476, 201, 197),

    # Jeep (American)
    ("Jeep", "Renegade", "suv", 424, 180, 168),
    ("Jeep", "Compass", "suv", 443, 182, 166),
    ("Jeep", "Cherokee", "suv", 465, 188, 173),
    ("Jeep", "Grand Cherokee", "suv", 493, 194, 176),

    # Tesla (American - Electric)
    ("Tesla", "Model 3", "sedan", 469, 185, 144),
    ("Tesla", "Model S", "sedan", 496, 196, 145),
    ("Tesla", "Model X", "suv", 504, 204, 168),
    ("Tesla", "Model Y", "suv", 487, 192, 162),

    # Dacia (Romanian/Renault)
    ("Dacia", "Sandero", "hatchback", 410, 173, 151),
    ("Dacia", "Duster", "suv", 434, 180, 169),
    ("Dacia", "Logan", "sedan", 443, 173, 149),

    # Mitsubishi (Japanese)
    ("Mitsubishi", "ASX", "suv", 437, 177, 164),
    ("Mitsubishi", "Outlander", "suv", 469, 184, 170),
    ("Mitsubishi", "L200", "truck", 532, 181, 178),

    # Suzuki (Japanese)
    ("Suzuki", "Swift", "hatchback", 384, 169, 150),
    ("Suzuki", "Vitara", "suv", 417, 177, 161),
    ("Suzuki", "S-Cross", "suv", 439, 178, 159),
]


def get_makes_list():
    """Return list of vehicle makes."""
    return VEHICLE_MAKES


def get_models_dict():
    """
    Return dictionary of models grouped by make.
    Format: {make: [(model, body_type, length, width, height), ...]}
    """
    models_by_make = {}
    for make, model, body_type, length, width, height in VEHICLE_MODELS:
        if make not in models_by_make:
            models_by_make[make] = []
        models_by_make[make].append((model, body_type, length, width, height))
    return models_by_make
