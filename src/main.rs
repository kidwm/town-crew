use bevy::camera::ScalingMode;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::prelude::*;

const VIEWPORT_HEIGHT: f32 = 12.0;
const BUCKET_HOME: Vec3 = Vec3::new(-1.25, 0.85, 0.0);
const DRAG_PLANE_HEIGHT: f32 = 0.85;
const ROCK_COUNT: u8 = 3;
const CONTACT_RADIUS: f32 = 1.35;
const ARM_PIVOT: Vec3 = Vec3::new(-4.0, 2.35, 0.0);
const BUCKET_JOINT_OFFSET: Vec3 = Vec3::new(-0.25, 0.35, 0.0);
const BOOM_LENGTH: f32 = 3.6;
const STICK_LENGTH: f32 = 4.0;
const ARM_REACH_MARGIN: f32 = 0.04;
const BUCKET_FOLLOW_SPEED: f32 = 24.0;

#[derive(Resource)]
struct ExcavatorStage {
    action: BucketAction,
    drag_offset: Vec3,
    drag_target: Vec3,
    cleared_rocks: u8,
    carried_rock: Option<Entity>,
    animation_elapsed: f32,
    scoop_start: Vec3,
}

impl Default for ExcavatorStage {
    fn default() -> Self {
        Self {
            action: BucketAction::Idle,
            drag_offset: Vec3::ZERO,
            drag_target: BUCKET_HOME,
            cleared_rocks: 0,
            carried_rock: None,
            animation_elapsed: 0.0,
            scoop_start: BUCKET_HOME,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum BucketAction {
    Idle,
    Dragging,
    Scooping,
    Returning,
    Complete,
}

#[derive(Component)]
struct DraggableBucket;

#[derive(Component)]
struct Rock {
    order: u8,
    rotation: Quat,
}

#[derive(Component)]
struct TargetHalo {
    order: u8,
}

#[derive(Component)]
struct ArmSegment {
    part: ArmPart,
}

#[derive(Clone, Copy)]
enum ArmPart {
    Boom,
    Stick,
}

#[derive(Component)]
struct CompletionFeedback;

#[derive(Resource)]
struct ExcavatorMaterials {
    rock_idle: Handle<StandardMaterial>,
    rock_active: Handle<StandardMaterial>,
}

fn main() {
    App::new()
        .add_plugins((DefaultPlugins, MeshPickingPlugin))
        .insert_resource(MeshPickingSettings {
            require_markers: true,
            ..default()
        })
        .insert_resource(ClearColor(Color::srgb(0.53, 0.81, 0.92)))
        .init_resource::<ExcavatorStage>()
        .add_systems(Startup, setup_scene)
        .add_systems(
            Update,
            (
                follow_bucket_drag,
                detect_bucket_contact,
                animate_scoop_and_return,
                update_arm,
                pulse_active_target,
                animate_completion_feedback,
            )
                .chain(),
        )
        .run();
}

fn unlit_material(
    materials: &mut Assets<StandardMaterial>,
    color: Color,
) -> Handle<StandardMaterial> {
    materials.add(StandardMaterial {
        base_color: color,
        unlit: true,
        ..default()
    })
}

fn setup_scene(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    commands.spawn((
        Camera3d::default(),
        MeshPickingCamera,
        Tonemapping::None,
        Projection::from(OrthographicProjection {
            scaling_mode: ScalingMode::FixedVertical {
                viewport_height: VIEWPORT_HEIGHT,
            },
            ..OrthographicProjection::default_3d()
        }),
        Transform::from_xyz(10.0, 10.0, 14.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 8_000.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(6.0, 10.0, 8.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    let grass = unlit_material(&mut materials, Color::srgb(0.32, 0.58, 0.30));
    let asphalt = unlit_material(&mut materials, Color::srgb(0.22, 0.24, 0.27));
    let road_yellow = unlit_material(&mut materials, Color::srgb(1.0, 0.82, 0.18));
    let pit_soil = unlit_material(&mut materials, Color::srgb(0.19, 0.12, 0.08));
    let pit_edge = unlit_material(&mut materials, Color::srgb(0.42, 0.25, 0.12));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(20.0, 0.2, 12.0))),
        MeshMaterial3d(grass),
        Transform::from_xyz(0.0, -0.2, 0.0),
    ));
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(16.0, 0.25, 4.5))),
        MeshMaterial3d(asphalt),
        Transform::from_xyz(0.0, 0.0, 0.0),
    ));

    let marking_mesh = meshes.add(Cuboid::new(1.7, 0.04, 0.18));
    for x in [-6.0, -3.5, 5.7] {
        commands.spawn((
            Mesh3d(marking_mesh.clone()),
            MeshMaterial3d(road_yellow.clone()),
            Transform::from_xyz(x, 0.15, 0.0),
        ));
    }

    commands.spawn((
        Mesh3d(meshes.add(Cylinder::new(2.55, 0.10).mesh().resolution(16))),
        MeshMaterial3d(pit_edge),
        Transform::from_xyz(2.25, 0.17, 0.0),
    ));
    commands.spawn((
        Mesh3d(meshes.add(Cylinder::new(2.2, 0.12).mesh().resolution(16))),
        MeshMaterial3d(pit_soil),
        Transform::from_xyz(2.25, 0.24, 0.0),
    ));

    spawn_excavator(&mut commands, &mut meshes, &mut materials);
    spawn_rocks(&mut commands, &mut meshes, &mut materials);
    spawn_completion_feedback(&mut commands, &mut meshes, &mut materials);
}

fn spawn_excavator(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let yellow = unlit_material(materials, Color::srgb(1.0, 0.62, 0.03));
    let yellow_dark = unlit_material(materials, Color::srgb(0.84, 0.40, 0.01));
    let track = unlit_material(materials, Color::srgb(0.10, 0.11, 0.12));
    let window = unlit_material(materials, Color::srgb(0.22, 0.66, 0.78));
    let bucket_material = unlit_material(materials, Color::srgb(0.90, 0.43, 0.02));

    let body_root = commands
        .spawn((Transform::from_xyz(-4.8, 0.0, 0.0), Visibility::default()))
        .id();
    commands.entity(body_root).with_children(|parent| {
        let mut cuboid = |size: Vec3| meshes.add(Cuboid::from_size(size));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(3.7, 0.65, 0.62))),
            MeshMaterial3d(track.clone()),
            Transform::from_xyz(0.0, 0.52, 0.95),
        ));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(3.7, 0.65, 0.62))),
            MeshMaterial3d(track.clone()),
            Transform::from_xyz(0.0, 0.52, -0.95),
        ));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(2.8, 0.45, 1.65))),
            MeshMaterial3d(yellow_dark.clone()),
            Transform::from_xyz(-0.05, 1.03, 0.0),
        ));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(1.5, 1.55, 1.55))),
            MeshMaterial3d(yellow.clone()),
            Transform::from_xyz(-0.55, 1.95, 0.0),
        ));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(1.12, 0.92, 0.04))),
            MeshMaterial3d(window),
            Transform::from_xyz(-0.25, 2.15, 0.795),
        ));
        parent.spawn((
            Mesh3d(cuboid(Vec3::new(1.2, 0.35, 1.45))),
            MeshMaterial3d(yellow.clone()),
            Transform::from_xyz(1.05, 1.45, 0.0),
        ));
    });

    let boom_mesh = meshes.add(Cuboid::new(0.38, BOOM_LENGTH, 0.46));
    let stick_mesh = meshes.add(Cuboid::new(0.38, STICK_LENGTH, 0.46));
    for part in [ArmPart::Boom, ArmPart::Stick] {
        let mesh = match part {
            ArmPart::Boom => boom_mesh.clone(),
            ArmPart::Stick => stick_mesh.clone(),
        };
        commands.spawn((
            ArmSegment { part },
            Mesh3d(mesh),
            MeshMaterial3d(yellow.clone()),
            Transform::default(),
        ));
    }

    let transparent_hitbox = materials.add(StandardMaterial {
        base_color: Color::srgba(1.0, 0.75, 0.15, 0.0),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });
    let bucket = commands
        .spawn((
            DraggableBucket,
            Pickable::default(),
            Mesh3d(meshes.add(Cuboid::new(1.85, 1.6, 1.85))),
            MeshMaterial3d(transparent_hitbox),
            Transform::from_translation(BUCKET_HOME),
        ))
        .observe(on_bucket_drag_start)
        .observe(on_bucket_drag)
        .observe(on_bucket_drag_end)
        .observe(on_bucket_pointer_cancel)
        .id();

    commands.entity(bucket).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.05, 0.55, 1.0))),
            MeshMaterial3d(bucket_material.clone()),
            Transform::from_xyz(0.15, -0.20, 0.0).with_rotation(Quat::from_rotation_z(-0.24)),
        ));
        for z in [-0.34, 0.0, 0.34] {
            parent.spawn((
                Mesh3d(meshes.add(Cuboid::new(0.40, 0.16, 0.16))),
                MeshMaterial3d(bucket_material.clone()),
                Transform::from_xyz(0.65, -0.43, z),
            ));
        }
    });
}

fn spawn_rocks(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let rock_idle = unlit_material(materials, Color::srgb(0.38, 0.40, 0.43));
    let rock_active = unlit_material(materials, Color::srgb(1.0, 0.83, 0.12));
    let halo_material = unlit_material(materials, Color::srgba(1.0, 0.86, 0.10, 0.72));
    let rock_mesh = meshes.add(Cuboid::new(1.0, 0.85, 0.9));
    let halo_mesh = meshes.add(Cylinder::new(0.82, 0.035).mesh().resolution(16));
    let positions = [
        Vec3::new(1.15, 0.70, -0.65),
        Vec3::new(2.35, 0.70, 0.55),
        Vec3::new(3.35, 0.70, -0.45),
    ];

    for (order, position) in positions.into_iter().enumerate() {
        let rotation = Quat::from_euler(
            EulerRot::YXZ,
            order as f32 * 0.7 + 0.25,
            0.12,
            order as f32 * 0.18 - 0.15,
        );
        commands.spawn((
            Rock {
                order: order as u8,
                rotation,
            },
            Mesh3d(rock_mesh.clone()),
            MeshMaterial3d(if order == 0 {
                rock_active.clone()
            } else {
                rock_idle.clone()
            }),
            Transform::from_translation(position)
                .with_rotation(rotation)
                .with_scale(Vec3::splat(0.82)),
        ));
        commands.spawn((
            TargetHalo { order: order as u8 },
            Mesh3d(halo_mesh.clone()),
            MeshMaterial3d(halo_material.clone()),
            Transform::from_xyz(position.x, 0.34, position.z),
            if order == 0 {
                Visibility::Visible
            } else {
                Visibility::Hidden
            },
        ));
    }

    commands.insert_resource(ExcavatorMaterials {
        rock_idle,
        rock_active,
    });
}

fn spawn_completion_feedback(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let green = unlit_material(materials, Color::srgb(0.16, 0.78, 0.32));
    let white = unlit_material(materials, Color::WHITE);
    let root = commands
        .spawn((
            CompletionFeedback,
            Transform::from_xyz(2.25, 0.55, 0.0),
            Visibility::Hidden,
        ))
        .id();

    commands.entity(root).with_children(|parent| {
        parent.spawn((
            Mesh3d(meshes.add(Cylinder::new(1.55, 0.16).mesh().resolution(20))),
            MeshMaterial3d(green),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.75, 0.16, 0.28))),
            MeshMaterial3d(white.clone()),
            Transform::from_xyz(-0.42, 0.13, 0.08).with_rotation(Quat::from_rotation_y(-0.70)),
        ));
        parent.spawn((
            Mesh3d(meshes.add(Cuboid::new(1.55, 0.16, 0.28))),
            MeshMaterial3d(white),
            Transform::from_xyz(0.34, 0.13, -0.16).with_rotation(Quat::from_rotation_y(0.70)),
        ));
    });
}

fn pointer_on_drag_plane(
    pointer_position: Vec2,
    camera: &Camera,
    camera_transform: &GlobalTransform,
) -> Option<Vec3> {
    let ray = camera
        .viewport_to_world(camera_transform, pointer_position)
        .ok()?;
    ray.plane_intersection_point(
        Vec3::new(0.0, DRAG_PLANE_HEIGHT, 0.0),
        InfinitePlane3d::new(Vec3::Y),
    )
}

fn on_bucket_drag_start(
    event: On<Pointer<DragStart>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mut stage: ResMut<ExcavatorStage>,
    bucket: Single<&Transform, With<DraggableBucket>>,
) {
    if event.button != PointerButton::Primary || stage.action != BucketAction::Idle {
        return;
    }
    let (camera, camera_transform) = *camera;
    let Some(pointer_position) =
        pointer_on_drag_plane(event.pointer_location.position, camera, camera_transform)
    else {
        return;
    };

    stage.drag_offset = bucket.translation - pointer_position;
    stage.drag_target = bucket.translation;
    stage.action = BucketAction::Dragging;
    info!("Bucket drag started");
}

fn on_bucket_drag(
    event: On<Pointer<Drag>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mut stage: ResMut<ExcavatorStage>,
) {
    if event.button != PointerButton::Primary || stage.action != BucketAction::Dragging {
        return;
    }
    let (camera, camera_transform) = *camera;
    let Some(pointer_position) =
        pointer_on_drag_plane(event.pointer_location.position, camera, camera_transform)
    else {
        return;
    };

    let desired = pointer_position + stage.drag_offset;
    let clamped = Vec3::new(
        desired.x.clamp(-2.0, 4.3),
        DRAG_PLANE_HEIGHT,
        desired.z.clamp(-1.65, 1.65),
    );
    stage.drag_target = project_bucket_target_to_arm_reach(clamped);
}

fn on_bucket_drag_end(event: On<Pointer<DragEnd>>, mut stage: ResMut<ExcavatorStage>) {
    if event.button == PointerButton::Primary && stage.action == BucketAction::Dragging {
        stage.action = BucketAction::Returning;
        info!("Bucket drag missed; returning for another try");
    }
}

fn on_bucket_pointer_cancel(_: On<Pointer<Cancel>>, mut stage: ResMut<ExcavatorStage>) {
    if stage.action == BucketAction::Dragging {
        stage.action = BucketAction::Returning;
        info!("Bucket pointer canceled; returning for another try");
    }
}

fn follow_bucket_drag(
    time: Res<Time>,
    stage: Res<ExcavatorStage>,
    mut bucket: Single<&mut Transform, With<DraggableBucket>>,
) {
    if stage.action != BucketAction::Dragging {
        return;
    }

    let follow = 1.0 - (-BUCKET_FOLLOW_SPEED * time.delta_secs()).exp();
    bucket.translation = bucket.translation.lerp(stage.drag_target, follow);
}

fn detect_bucket_contact(
    mut stage: ResMut<ExcavatorStage>,
    bucket: Single<&Transform, With<DraggableBucket>>,
    rocks: Query<(Entity, &Rock, &Transform)>,
) {
    if stage.action != BucketAction::Dragging {
        return;
    }

    let active_rock = rocks
        .iter()
        .find(|(_, rock, _)| rock.order == stage.cleared_rocks);
    let Some((rock_entity, _, rock_transform)) = active_rock else {
        return;
    };
    let bucket_xz = bucket.translation.xz();
    let rock_xz = rock_transform.translation.xz();
    if bucket_xz.distance(rock_xz) <= CONTACT_RADIUS {
        stage.action = BucketAction::Scooping;
        stage.carried_rock = Some(rock_entity);
        stage.animation_elapsed = 0.0;
        stage.scoop_start = bucket.translation;
        info!(
            "Rock {} contacted; automatic scoop started",
            stage.cleared_rocks + 1
        );
    }
}

fn animate_scoop_and_return(
    time: Res<Time>,
    mut commands: Commands,
    mut stage: ResMut<ExcavatorStage>,
    mut bucket: Single<&mut Transform, With<DraggableBucket>>,
    mut rocks: Query<&mut Transform, (With<Rock>, Without<DraggableBucket>)>,
    mut completion: Single<&mut Visibility, With<CompletionFeedback>>,
) {
    match stage.action {
        BucketAction::Scooping => {
            stage.animation_elapsed += time.delta_secs();
            let t = (stage.animation_elapsed / 0.72).clamp(0.0, 1.0);
            let eased = 1.0 - (1.0 - t) * (1.0 - t);
            let scoop_target = stage
                .scoop_start
                .lerp(stage.scoop_start + Vec3::new(-0.8, 2.0, 0.0), eased);
            bucket.translation = project_bucket_target_to_arm_reach(scoop_target);
            if let Some(rock_entity) = stage.carried_rock
                && let Ok(mut rock_transform) = rocks.get_mut(rock_entity)
            {
                rock_transform.translation = bucket.translation + Vec3::new(0.2, -0.2, 0.0);
                rock_transform.scale = Vec3::splat((1.0 - t).max(0.05) * 0.82);
            }

            if t >= 1.0 {
                if let Some(rock_entity) = stage.carried_rock.take() {
                    commands.entity(rock_entity).despawn();
                }
                stage.cleared_rocks += 1;
                stage.action = BucketAction::Returning;
                stage.animation_elapsed = 0.0;
                info!("Cleared {} of {} rocks", stage.cleared_rocks, ROCK_COUNT);
            }
        }
        BucketAction::Returning => {
            let difference = BUCKET_HOME - bucket.translation;
            let distance = difference.length();
            let step = time.delta_secs() * 7.0;
            if distance <= step {
                bucket.translation = project_bucket_target_to_arm_reach(BUCKET_HOME);
                if stage.cleared_rocks == ROCK_COUNT {
                    stage.action = BucketAction::Complete;
                    **completion = Visibility::Visible;
                    info!("Excavator stage complete");
                } else {
                    stage.action = BucketAction::Idle;
                }
            } else {
                let return_target = bucket.translation + difference / distance * step;
                bucket.translation = project_bucket_target_to_arm_reach(return_target);
            }
        }
        BucketAction::Idle | BucketAction::Dragging | BucketAction::Complete => {}
    }
}

fn segment_transform(start: Vec3, end: Vec3) -> Transform {
    let delta = end - start;
    Transform::from_translation((start + end) * 0.5)
        .with_rotation(Quat::from_rotation_arc(Vec3::Y, delta.normalize()))
}

fn project_bucket_target_to_arm_reach(target: Vec3) -> Vec3 {
    let joint_target = target + BUCKET_JOINT_OFFSET;
    let offset = joint_target - ARM_PIVOT;
    let distance = offset.length();
    let direction = if distance > f32::EPSILON {
        offset / distance
    } else {
        Vec3::X
    };
    let minimum_reach = (BOOM_LENGTH - STICK_LENGTH).abs() + ARM_REACH_MARGIN;
    let maximum_reach = BOOM_LENGTH + STICK_LENGTH - ARM_REACH_MARGIN;
    let reachable_joint = ARM_PIVOT + direction * distance.clamp(minimum_reach, maximum_reach);
    reachable_joint - BUCKET_JOINT_OFFSET
}

fn solve_arm_elbow(bucket_joint: Vec3) -> Vec3 {
    let offset = bucket_joint - ARM_PIVOT;
    let distance = offset.length();
    let direction = if distance > f32::EPSILON {
        offset / distance
    } else {
        Vec3::X
    };
    let distance = distance.clamp(
        (BOOM_LENGTH - STICK_LENGTH).abs() + ARM_REACH_MARGIN,
        BOOM_LENGTH + STICK_LENGTH - ARM_REACH_MARGIN,
    );
    let along = (BOOM_LENGTH * BOOM_LENGTH - STICK_LENGTH * STICK_LENGTH + distance * distance)
        / (2.0 * distance);
    let bend_height = (BOOM_LENGTH * BOOM_LENGTH - along * along).max(0.0).sqrt();

    // Keep the elbow on the world-up side of the pivot-target line. This defines a
    // stable 2.5D bend plane even while the bucket crosses the road's center line.
    let up_rejection = Vec3::Y - direction * direction.dot(Vec3::Y);
    let bend_direction = if up_rejection.length_squared() > 1e-6 {
        up_rejection.normalize()
    } else {
        Vec3::X
    };

    ARM_PIVOT + direction * along + bend_direction * bend_height
}

fn update_arm(
    bucket: Single<&Transform, With<DraggableBucket>>,
    mut segments: Query<(&ArmSegment, &mut Transform), Without<DraggableBucket>>,
) {
    let bucket_joint = bucket.translation + BUCKET_JOINT_OFFSET;
    let elbow = solve_arm_elbow(bucket_joint);
    for (segment, mut transform) in &mut segments {
        *transform = match segment.part {
            ArmPart::Boom => segment_transform(ARM_PIVOT, elbow),
            ArmPart::Stick => segment_transform(elbow, bucket_joint),
        };
    }
}

fn pulse_active_target(
    time: Res<Time>,
    stage: Res<ExcavatorStage>,
    excavator_materials: Res<ExcavatorMaterials>,
    mut rocks: Query<(&Rock, &mut Transform, &mut MeshMaterial3d<StandardMaterial>)>,
    mut halos: Query<(&TargetHalo, &mut Transform, &mut Visibility), Without<Rock>>,
) {
    let pulse = 1.0 + (time.elapsed_secs() * 5.0).sin() * 0.12;
    for (rock, mut transform, mut material) in &mut rocks {
        if stage.carried_rock.is_some() && rock.order == stage.cleared_rocks {
            continue;
        }
        let active = rock.order == stage.cleared_rocks && stage.action != BucketAction::Complete;
        transform.rotation = rock.rotation;
        transform.scale = Vec3::splat(if active { 0.82 * pulse } else { 0.72 });
        material.0 = if active {
            excavator_materials.rock_active.clone()
        } else {
            excavator_materials.rock_idle.clone()
        };
    }

    for (halo, mut transform, mut visibility) in &mut halos {
        let active = halo.order == stage.cleared_rocks
            && matches!(stage.action, BucketAction::Idle | BucketAction::Dragging);
        *visibility = if active {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };
        transform.scale = Vec3::splat(pulse);
    }
}

fn animate_completion_feedback(
    time: Res<Time>,
    stage: Res<ExcavatorStage>,
    mut feedback: Single<&mut Transform, With<CompletionFeedback>>,
) {
    if stage.action == BucketAction::Complete {
        let pulse = 1.0 + (time.elapsed_secs() * 4.0).sin() * 0.08;
        feedback.scale = Vec3::splat(pulse);
        feedback.rotation = Quat::from_rotation_y((time.elapsed_secs() * 1.5).sin() * 0.08);
    }
}
