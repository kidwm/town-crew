use super::super::*;

pub(crate) fn spawn_excavator(
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
        .spawn((
            ExcavatorVisual,
            Transform::from_xyz(-4.8, 0.0, 0.0),
            Visibility::default(),
        ))
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
            ExcavatorVisual,
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
            ExcavatorVisual,
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
        parent
            .spawn((BucketDragHint, Transform::default(), Visibility::Visible))
            .with_children(|visual| {
                visual.spawn((
                    Mesh3d(meshes.add(Cuboid::new(1.05, 0.55, 1.0))),
                    MeshMaterial3d(bucket_material.clone()),
                    Transform::from_xyz(0.15, -0.20, 0.0)
                        .with_rotation(Quat::from_rotation_z(-0.24)),
                ));
                for z in [-0.34, 0.0, 0.34] {
                    visual.spawn((
                        Mesh3d(meshes.add(Cuboid::new(0.40, 0.16, 0.16))),
                        MeshMaterial3d(bucket_material.clone()),
                        Transform::from_xyz(0.65, -0.43, z),
                    ));
                }
            });
    });
}

pub(crate) fn spawn_rocks(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let rock_idle = unlit_material(materials, Color::srgb(0.38, 0.40, 0.43));
    let rock_active = unlit_material(materials, Color::srgb(1.0, 0.83, 0.12));
    let halo_material = unlit_material(materials, Color::srgba(1.0, 0.86, 0.10, 0.72));
    let rock_mesh = meshes.add(Cuboid::new(1.0, 0.85, 0.9));
    let halo_mesh = meshes.add(Cylinder::new(0.82, 0.035).mesh().resolution(16));
    for order in 0..ROCK_COUNT {
        let position = rock_position(order);
        let rotation = rock_rotation(order);
        commands.spawn((
            Rock { order, rotation },
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
            TargetHalo { order },
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

    let trail_mesh = meshes.add(Cuboid::new(0.28, 0.28, 0.28));
    for index in 0..4 {
        commands.spawn((
            BucketDragTrail {
                offset: index as f32 / 4.0,
            },
            Mesh3d(trail_mesh.clone()),
            MeshMaterial3d(halo_material.clone()),
            Transform::default(),
            Visibility::Visible,
        ));
    }

    commands.insert_resource(ExcavatorMaterials {
        rock_idle,
        rock_active,
    });
}

pub(crate) fn rock_position(order: u8) -> Vec3 {
    match order {
        0 => Vec3::new(1.15, 0.70, -0.65),
        1 => Vec3::new(2.35, 0.70, 0.55),
        _ => Vec3::new(3.35, 0.70, -0.45),
    }
}

pub(crate) fn rock_rotation(order: u8) -> Quat {
    Quat::from_euler(
        EulerRot::YXZ,
        order as f32 * 0.7 + 0.25,
        0.12,
        order as f32 * 0.18 - 0.15,
    )
}

pub(crate) fn on_bucket_drag_start(
    event: On<Pointer<DragStart>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mission: Res<Mission>,
    mut stage: ResMut<ExcavatorStage>,
    bucket: Single<&Transform, With<DraggableBucket>>,
) {
    if event.button != PointerButton::Primary
        || mission.phase != MissionPhase::Excavator
        || stage.action != BucketAction::Idle
    {
        return;
    }
    let (camera, camera_transform) = *camera;
    let Some(pointer_position) = pointer_on_horizontal_plane(
        event.pointer_location.position,
        camera,
        camera_transform,
        DRAG_PLANE_HEIGHT,
    ) else {
        return;
    };

    stage.drag_offset = bucket.translation - pointer_position;
    stage.drag_target = bucket.translation;
    stage.action = BucketAction::Dragging;
    info!("Bucket drag started");
}

pub(crate) fn on_bucket_drag(
    event: On<Pointer<Drag>>,
    camera: Single<(&Camera, &GlobalTransform), With<MeshPickingCamera>>,
    mission: Res<Mission>,
    mut stage: ResMut<ExcavatorStage>,
) {
    if event.button != PointerButton::Primary
        || mission.phase != MissionPhase::Excavator
        || stage.action != BucketAction::Dragging
    {
        return;
    }
    let (camera, camera_transform) = *camera;
    let Some(pointer_position) = pointer_on_horizontal_plane(
        event.pointer_location.position,
        camera,
        camera_transform,
        DRAG_PLANE_HEIGHT,
    ) else {
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

pub(crate) fn on_bucket_drag_end(event: On<Pointer<DragEnd>>, mut stage: ResMut<ExcavatorStage>) {
    if event.button == PointerButton::Primary && stage.action == BucketAction::Dragging {
        stage.action = BucketAction::Returning;
        info!("Bucket drag missed; returning for another try");
    }
}

pub(crate) fn on_bucket_pointer_cancel(_: On<Pointer<Cancel>>, mut stage: ResMut<ExcavatorStage>) {
    if stage.action == BucketAction::Dragging {
        stage.action = BucketAction::Returning;
        info!("Bucket pointer canceled; returning for another try");
    }
}

pub(crate) fn follow_bucket_drag(
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

pub(crate) fn detect_bucket_contact(
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

pub(crate) fn animate_scoop_and_return(
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
                    commands.entity(rock_entity).insert(Visibility::Hidden);
                }
                stage.cleared_rocks += 1;
                stage.action = BucketAction::Returning;
                stage.animation_elapsed = 0.0;
                info!("Cleared {} of {} rocks", stage.cleared_rocks, ROCK_COUNT);
            }
        }
        BucketAction::Returning => {
            bucket.translation = project_bucket_target_to_arm_reach(smooth_follow(
                bucket.translation,
                BUCKET_HOME,
                7.0,
                time.delta_secs(),
            ));
            if bucket.translation.distance(BUCKET_HOME) <= 0.035 {
                bucket.translation = project_bucket_target_to_arm_reach(BUCKET_HOME);
                if stage.cleared_rocks == ROCK_COUNT {
                    stage.action = BucketAction::Complete;
                    **completion = Visibility::Visible;
                    info!("Excavator stage complete");
                } else {
                    stage.action = BucketAction::Idle;
                }
            }
        }
        BucketAction::Idle | BucketAction::Dragging | BucketAction::Complete => {}
    }
}

pub(crate) fn segment_transform(start: Vec3, end: Vec3) -> Transform {
    let delta = end - start;
    Transform::from_translation((start + end) * 0.5)
        .with_rotation(Quat::from_rotation_arc(Vec3::Y, delta.normalize()))
}

pub(crate) fn project_bucket_target_to_arm_reach(target: Vec3) -> Vec3 {
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

pub(crate) fn solve_arm_elbow(bucket_joint: Vec3) -> Vec3 {
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

pub(crate) fn update_arm(
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

pub(crate) fn pulse_active_target(
    time: Res<Time>,
    mission: Res<Mission>,
    stage: Res<ExcavatorStage>,
    excavator_materials: Res<ExcavatorMaterials>,
    mut rocks: Query<(&Rock, &mut Transform, &mut MeshMaterial3d<StandardMaterial>)>,
    mut halos: Query<(&TargetHalo, &mut Transform, &mut Visibility), Without<Rock>>,
    mut bucket_hint: Single<
        (&mut Transform, &mut Visibility),
        (
            With<BucketDragHint>,
            Without<Rock>,
            Without<TargetHalo>,
            Without<BucketDragTrail>,
        ),
    >,
    mut trail: Query<
        (&BucketDragTrail, &mut Transform, &mut Visibility),
        (Without<Rock>, Without<TargetHalo>, Without<BucketDragHint>),
    >,
) {
    let wave = hint_wave(&time, 5.0, 0.0);
    let pulse = 0.88 + wave * 0.24;
    let excavator_active = mission.phase == MissionPhase::Excavator;
    let hint_active = excavator_active && stage.action == BucketAction::Idle;
    let (hint_transform, hint_visibility) = &mut *bucket_hint;
    **hint_visibility = if excavator_active {
        Visibility::Visible
    } else {
        Visibility::Hidden
    };
    if hint_active {
        hint_transform.translation = Vec3::Y * wave * 0.18;
        hint_transform.scale = Vec3::splat(1.0 + wave * 0.16);
    } else {
        hint_transform.translation = Vec3::ZERO;
        hint_transform.scale = Vec3::ONE;
    }

    let trail_start = BUCKET_HOME + Vec3::new(0.35, 0.45, 0.0);
    let trail_end = rock_position(stage.cleared_rocks) + Vec3::Y * 0.45;
    for (trail_point, mut transform, mut visibility) in &mut trail {
        *visibility = if hint_active {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };
        let progress = (time.elapsed_secs() * 0.55 + trail_point.offset).fract();
        transform.translation = trail_start.lerp(trail_end, progress);
        let fade = (progress * std::f32::consts::PI).sin();
        transform.scale = Vec3::splat(0.65 + fade * 0.45);
        transform.rotation = Quat::from_rotation_y(progress * std::f32::consts::TAU);
    }
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

pub(crate) fn reset_excavator(
    restart: Res<RestartRequest>,
    mut excavator_visuals: Query<
        (&mut Visibility, &mut Transform, Has<DraggableBucket>),
        ResetExcavatorFilter,
    >,
    mut rocks: Query<(&Rock, &mut Transform, &mut Visibility), ResetRockFilter>,
    mut halos: Query<(&TargetHalo, &mut Transform, &mut Visibility), ResetHaloFilter>,
    mut trail: Query<
        (&mut Transform, &mut Visibility),
        (
            With<BucketDragTrail>,
            Without<ExcavatorVisual>,
            Without<Rock>,
            Without<TargetHalo>,
        ),
    >,
) {
    if !restart.0 {
        return;
    }

    for (mut visibility, mut transform, is_bucket) in &mut excavator_visuals {
        *visibility = Visibility::Visible;
        if is_bucket {
            *transform = Transform::from_translation(BUCKET_HOME);
        }
    }
    for (rock, mut transform, mut visibility) in &mut rocks {
        *visibility = Visibility::Visible;
        *transform = Transform::from_translation(rock_position(rock.order))
            .with_rotation(rock.rotation)
            .with_scale(Vec3::splat(0.82));
    }
    for (halo, mut transform, mut visibility) in &mut halos {
        let position = rock_position(halo.order);
        *transform = Transform::from_xyz(position.x, 0.34, position.z);
        *visibility = if halo.order == 0 {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };
    }
    for (mut transform, mut visibility) in &mut trail {
        *transform = Transform::default();
        *visibility = Visibility::Visible;
    }
}
