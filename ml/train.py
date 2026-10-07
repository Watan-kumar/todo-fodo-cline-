import os
from pathlib import Path

# --- 1. PREVENT OVERHEATING & MEMORY SPIKES ---
os.environ["TF_NUM_INTRAOP_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import tensorflow as tf

tf.config.threading.set_intra_op_parallelism_threads(1)
tf.config.threading.set_inter_op_parallelism_threads(1)

# --- 2. CONFIGURATION ---
IMG_SIZE = (48, 48)
BATCH_SIZE = 16
EPOCHS = 2

BASE_DIR = Path(__file__).resolve().parent.parent
TRAIN_DIR = BASE_DIR / "Clean_Dataset" / "Plant Diseases Dataset(Augmented)" / "train"

print(f"Loading data directly from: {TRAIN_DIR}")

# --- 3. SPLIT DIRECTLY FROM TRAIN (Guarantees matched classes) ---
train_ds = tf.keras.utils.image_dataset_from_directory(
    str(TRAIN_DIR),
    validation_split=0.2,
    subset="training",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="categorical",
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    str(TRAIN_DIR),
    validation_split=0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="categorical",
)

class_names = train_ds.class_names
num_classes = len(class_names)
print(f"Detected {num_classes} classes.")

# --- 4. LIGHTWEIGHT SLICE FOR QUICK EXECUTION ---
train_ds = train_ds.take(20)
val_ds = val_ds.take(5)

# --- 5. COMPACT MODEL ARCHITECTURE ---
def build_model(num_classes: int):
    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3))
    x = tf.keras.layers.Rescaling(1.0 / 255)(inputs)
    x = tf.keras.layers.Conv2D(16, (3, 3), activation="relu")(x)
    x = tf.keras.layers.MaxPooling2D()(x)
    x = tf.keras.layers.Conv2D(32, (3, 3), activation="relu")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs=inputs, outputs=outputs)

model = build_model(num_classes=num_classes)
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

# --- 6. TRAIN ---
print("Starting lightweight training...")
model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
)

# --- 7. SAVE ARTIFACTS ---
save_path = BASE_DIR / "ml" / "crop_disease_model.keras"
model.save(str(save_path))

labels_path = BASE_DIR / "ml" / "class_names.txt"
with open(labels_path, "w") as f:
    for cls in class_names:
        f.write(f"{cls}\n")

print(f"\nModel saved to: {save_path}")
print(f"Class names saved to: {labels_path}")