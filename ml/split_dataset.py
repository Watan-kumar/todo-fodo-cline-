
import os
import random
import shutil

# Change this to your dataset location
dataset_path = "/home/student/Documents/crop_disease_ai_project/Clean_Dataset/Plant Diseases Dataset(Augmented)"

train_path = os.path.join(dataset_path, "train")
test_path = os.path.join(dataset_path, "test")

# Percentage of TRAIN images to move to TEST
TEST_PERCENTAGE = 0.10   # 10%

# Create test folder
os.makedirs(test_path, exist_ok=True)

# Go through every class/disease folder
for class_name in os.listdir(train_path):

    class_train_path = os.path.join(train_path, class_name)

    if not os.path.isdir(class_train_path):
        continue

    # Create same class folder inside test
    class_test_path = os.path.join(test_path, class_name)
    os.makedirs(class_test_path, exist_ok=True)

    # Get image files
    images = [
        f for f in os.listdir(class_train_path)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ]

    # Randomly shuffle
    random.shuffle(images)

    # Number of images to move
    number_to_move = int(len(images) * TEST_PERCENTAGE)

    selected_images = images[:number_to_move]

    # MOVE images
    for image in selected_images:
        source = os.path.join(class_train_path, image)
        destination = os.path.join(class_test_path, image)

        shutil.move(source, destination)

    print(f"{class_name}: moved {number_to_move} images")

print("\n✅ Finished!")